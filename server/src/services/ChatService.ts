import type { Response } from 'express';
import { getAdapter } from '../adapters';
import type { UpstreamRequest } from '../adapters/types';
import { getProviderDefinition } from '../config/providers.config';
import { env } from '../config/env';
import { HeaderManagementService } from './HeaderManagementService';
import { signRequest, type SigV4Credentials } from './aws/sigv4';
import { joinUrl } from '../utils/headers';
import { EndpointError, resolveProviderUrl, resolveRegion } from '../utils/endpoint';
import { verdictFromError, verdictFromFinish } from '../utils/guardrail';
import { logger } from '../utils/logger';
import type { AdapterEvent, ApiStyle, ChatRequestBody, GatewayApiStyle, NormalizedStreamEvent, NormalizedUsage } from '../types';

class ChatRequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface ResolvedUpstream {
  url: string;
  headers: Record<string, string>;
  apiStyle: ApiStyle;
  supportsStreaming: boolean;
  includeStreamUsage: boolean;
  maxTokensField?: UpstreamRequest['maxTokensField'];
  /** Applied after the body is serialized (SigV4 signs the exact bytes). */
  sign?: (url: string, headers: Record<string, string>, body: string) => Record<string, string>;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const ANTHROPIC_DEFAULT_HEADERS = { 'anthropic-version': '2023-06-01' };

/** Explicit setting wins; otherwise a path ending in /messages means Anthropic's Messages API. */
export function resolveGatewayApiStyle(apiStyle: GatewayApiStyle | undefined, endpointPath: string): GatewayApiStyle {
  if (apiStyle === 'openai' || apiStyle === 'anthropic') return apiStyle;
  return /\/messages\/?$/i.test(endpointPath.split('?')[0]) ? 'anthropic' : 'openai';
}

function resolveAwsAuth(
  body: ChatRequestBody,
  region: string,
): Pick<ResolvedUpstream, 'sign'> & { headers: Record<string, string> } {
  const config = body.provider!;
  const mode = config.awsAuthMode ?? 'api-key';

  if (mode === 'api-key') {
    const key = config.apiKey?.trim() || env.defaultProviderKeys['aws-bedrock'];
    if (!key) {
      throw new ChatRequestError(
        'Enter a Bedrock API key, or switch the auth method to IAM access keys. (The server has no AWS_BEARER_TOKEN_BEDROCK set.)',
      );
    }
    return { headers: { Authorization: `Bearer ${key}` } };
  }

  const fromRequest = config.aws?.accessKeyId?.trim() && config.aws?.secretAccessKey?.trim();
  const credentials: SigV4Credentials | undefined = fromRequest
    ? {
        accessKeyId: config.aws!.accessKeyId!.trim(),
        secretAccessKey: config.aws!.secretAccessKey!.trim(),
        sessionToken: config.aws!.sessionToken?.trim() || undefined,
      }
    : env.aws.accessKeyId && env.aws.secretAccessKey
      ? { accessKeyId: env.aws.accessKeyId, secretAccessKey: env.aws.secretAccessKey, sessionToken: env.aws.sessionToken || undefined }
      : undefined;

  if (!credentials) {
    throw new ChatRequestError(
      'Enter an AWS access key ID and secret access key, or set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY on the server.',
    );
  }

  return {
    headers: {},
    sign: (url, headers, payload) =>
      signRequest({ method: 'POST', url, headers, body: payload }, { service: 'bedrock', region, credentials }),
  };
}

function resolveUpstream(body: ChatRequestBody, stream: boolean): ResolvedUpstream {
  if (body.mode === 'provider') {
    const config = body.provider;
    if (!config) throw new ChatRequestError('Provider configuration is required.');

    const definition = getProviderDefinition(config.providerId);
    if (!definition) throw new ChatRequestError(`Unknown provider "${config.providerId}".`);

    const headerError = HeaderManagementService.validateEntries(config.headers);
    if (headerError) throw new ChatRequestError(headerError);

    const wantsStream = stream && definition.supportsStreaming;
    let url: string;
    let auth: Pick<ResolvedUpstream, 'sign'> & { headers: Record<string, string> };

    try {
      const region = definition.regions ? resolveRegion(definition, config.region, env.aws.region) : undefined;
      // The top-level model is authoritative; it's the one sent in the body too.
      url = resolveProviderUrl(definition, { ...config, model: body.model }, {
        stream: wantsStream,
        region,
        serverBaseUrl: env.defaultProviderBaseUrls[definition.id],
      });

      if (definition.authHeaderStyle === 'aws') {
        auth = resolveAwsAuth(body, region!);
      } else {
        const apiKey = config.apiKey?.trim() || env.defaultProviderKeys[definition.id];
        if (!apiKey && definition.authHeaderStyle !== 'none') {
          throw new ChatRequestError(`Enter an API key for ${definition.label}.`);
        }
        auth = {
          headers: HeaderManagementService.buildAuthHeaders(definition.authHeaderStyle, apiKey, definition.authFieldName),
        };
      }
    } catch (error) {
      if (error instanceof EndpointError) throw new ChatRequestError(error.message);
      throw error;
    }

    return {
      url,
      headers: HeaderManagementService.mergeHeaders(
        JSON_HEADERS,
        definition.staticHeaders,
        auth.headers,
        HeaderManagementService.fromEntries(config.headers),
      ),
      apiStyle: definition.apiStyle,
      supportsStreaming: definition.supportsStreaming,
      includeStreamUsage: Boolean(definition.streamUsageOption),
      maxTokensField: definition.maxTokensField,
      sign: auth.sign,
    };
  }

  const gateway = body.gateway;
  if (!gateway) throw new ChatRequestError('Gateway configuration is required.');
  if (!gateway.baseUrl?.trim()) throw new ChatRequestError('Gateway base URL is required.');

  const headerError = HeaderManagementService.validateEntries(gateway.headers);
  if (headerError) throw new ChatRequestError(headerError);

  const endpointPath = gateway.endpointPath || '/chat/completions';
  const apiStyle = resolveGatewayApiStyle(gateway.apiStyle, endpointPath);

  return {
    url: joinUrl(gateway.baseUrl, endpointPath),
    headers: HeaderManagementService.mergeHeaders(
      JSON_HEADERS,
      // Anthropic-format endpoints expect a version header; a custom header can override it.
      apiStyle === 'anthropic' ? ANTHROPIC_DEFAULT_HEADERS : undefined,
      HeaderManagementService.buildGatewayAuthHeaders(gateway.authMethod, gateway.apiKey, gateway.authHeaderName),
      HeaderManagementService.fromEntries(gateway.headers),
    ),
    apiStyle,
    supportsStreaming: true,
    includeStreamUsage: false,
    maxTokensField: gateway.maxTokensField === 'none' ? undefined : gateway.maxTokensField ?? 'max_tokens',
  };
}

function writeSseEvent(res: Response, event: NormalizedStreamEvent): void {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/** Reads an error body that may be JSON, plain text, or an HTML block page. */
async function readErrorBody(response: globalThis.Response): Promise<{ json?: unknown; text: string }> {
  const text = await response.text().catch(() => '');
  try {
    return { json: JSON.parse(text), text };
  } catch {
    const plain = text.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
    return { text: plain.replace(/\s+/g, ' ').trim().slice(0, 400) };
  }
}

/** Accumulates normalized adapter events into the single final `done` frame. */
class ResponseAccumulator {
  usage: NormalizedUsage = {};
  model?: string;
  finishReason?: string;
  error?: string;
  receivedText = false;

  apply(res: Response, events: AdapterEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'delta':
          this.receivedText = true;
          writeSseEvent(res, { type: 'delta', content: event.content });
          break;
        case 'usage':
          for (const [key, value] of Object.entries(event.usage)) {
            if (value !== undefined) this.usage[key as keyof NormalizedUsage] = value;
          }
          break;
        case 'model':
          this.model = event.model;
          break;
        case 'finish':
          this.finishReason = event.reason;
          break;
        case 'error':
          this.error = event.message;
          break;
      }
    }
  }

  finalUsage(): NormalizedUsage | undefined {
    const { promptTokens, completionTokens } = this.usage;
    if (promptTokens === undefined && completionTokens === undefined && this.usage.totalTokens === undefined) {
      return undefined;
    }
    return {
      ...this.usage,
      totalTokens: this.usage.totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0),
    };
  }
}

/**
 * ChatService is the provider-agnostic core: it resolves *where* a request
 * goes, *how* it is authenticated, and *which* wire dialect it speaks, then
 * delegates request-shaping and response-decoding to the matching adapter.
 * Nothing in this file branches on a specific provider name.
 */
export const ChatService = {
  async streamChat(body: ChatRequestBody, res: Response): Promise<void> {
    const model = body.model?.trim();
    if (!model) throw new ChatRequestError('A model name is required.');
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new ChatRequestError('At least one message is required.');
    }

    const requestedStream = body.stream ?? env.defaultStreaming;
    const upstream = resolveUpstream({ ...body, model }, requestedStream);
    const wantsStream = requestedStream && upstream.supportsStreaming;
    const adapter = getAdapter(upstream.apiStyle);
    const timeoutMs = body.timeoutMs ?? env.defaultTimeoutMs;

    const payload = JSON.stringify(
      adapter.buildBody({
        model,
        messages: body.messages,
        systemPrompt: body.systemPrompt,
        temperature: body.temperature,
        maxTokens: body.maxTokens ?? env.defaultMaxTokens,
        stream: wantsStream,
        includeStreamUsage: upstream.includeStreamUsage,
        maxTokensField: upstream.maxTokensField,
      }),
    );
    const headers = upstream.sign ? upstream.sign(upstream.url, upstream.headers, payload) : upstream.headers;

    logger.debug('Dispatching upstream chat request', { url: upstream.url, apiStyle: upstream.apiStyle, model, stream: wantsStream });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
    // Stop paying for tokens nobody will read: if the browser goes away, cancel upstream.
    res.on('close', () => {
      if (!res.writableEnded) controller.abort(new Error('client-closed'));
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`: connected\n\n`);

    const startedAt = Date.now();
    const acc = new ResponseAccumulator();

    try {
      const upstreamResponse = await fetch(upstream.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      });

      if (!upstreamResponse.ok) {
        const status = upstreamResponse.status;
        const errorBody = await readErrorBody(upstreamResponse);
        const message =
          errorBody.json !== undefined
            ? adapter.parseErrorPayload(errorBody.json, status, upstreamResponse.headers)
            : errorBody.text || `Upstream returned HTTP ${status}.`;
        writeSseEvent(res, { type: 'error', message, status, verdict: verdictFromError(message, status) });
        res.end();
        return;
      }

      if (!wantsStream || !upstreamResponse.body) {
        acc.apply(res, adapter.parseNonStreamResponse(await upstreamResponse.json()));
      } else {
        const decoder = adapter.createStreamDecoder();
        for await (const chunk of upstreamResponse.body as unknown as AsyncIterable<Uint8Array>) {
          acc.apply(res, decoder.push(chunk));
        }
        acc.apply(res, decoder.flush());
      }

      if (acc.error) {
        writeSseEvent(res, { type: 'error', message: acc.error, verdict: verdictFromError(acc.error) });
      } else {
        writeSseEvent(res, {
          type: 'done',
          usage: acc.finalUsage(),
          model: acc.model ?? model,
          finishReason: acc.finishReason,
          verdict: verdictFromFinish(acc.finishReason),
          latencyMs: Date.now() - startedAt,
        });
      }
      res.end();
    } catch (error) {
      const reason = (controller.signal.reason as Error | undefined)?.message;
      if (reason === 'client-closed') return;
      writeSseEvent(res, {
        type: 'error',
        message:
          reason === 'timeout'
            ? `The upstream request timed out after ${Math.round(timeoutMs / 1000)}s.`
            : `Unable to reach the upstream service: ${(error as Error).message}`,
        verdict: 'failed',
      });
      res.end();
    } finally {
      clearTimeout(timeout);
    }
  },
};

export { ChatRequestError, resolveUpstream as __resolveUpstreamForTests };
