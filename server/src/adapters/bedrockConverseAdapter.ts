import type { Adapter, StreamDecoder, UpstreamRequest } from './types';
import type { AdapterEvent } from '../types';
import { EventStreamDecoder } from './awsEventStream';
import { safeJson } from './sse';
import { toAlternatingTurns } from './turns';

interface ConverseUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

function usageEvent(usage: ConverseUsage): AdapterEvent {
  return {
    type: 'usage',
    usage: { promptTokens: usage.inputTokens, completionTokens: usage.outputTokens, totalTokens: usage.totalTokens },
  };
}

const textDecoder = new TextDecoder();

/**
 * Adapter for Amazon Bedrock's Converse / ConverseStream API — one request
 * shape for every Bedrock text model (Anthropic, Amazon Nova, Meta, Mistral,
 * Cohere, …), so model ids and inference-profile ARNs can be swapped freely.
 *   POST /model/{modelId}/converse
 *   POST /model/{modelId}/converse-stream   (binary AWS event stream)
 */
export const bedrockConverseAdapter: Adapter = {
  buildBody(request: UpstreamRequest) {
    const messages = toAlternatingTurns(request.messages).map((turn) => ({
      role: turn.role,
      content: [{ text: turn.content }],
    }));

    const inferenceConfig: Record<string, number> = {};
    if (request.maxTokens) inferenceConfig.maxTokens = request.maxTokens;
    if (request.temperature !== undefined) inferenceConfig.temperature = request.temperature;

    return {
      messages,
      ...(request.systemPrompt?.trim() ? { system: [{ text: request.systemPrompt.trim() }] } : {}),
      ...(Object.keys(inferenceConfig).length ? { inferenceConfig } : {}),
    };
  },

  createStreamDecoder(): StreamDecoder {
    const frames = new EventStreamDecoder();

    return {
      push(chunk) {
        const events: AdapterEvent[] = [];
        let messages;
        try {
          messages = frames.push(chunk);
        } catch (error) {
          return [{ type: 'error', message: (error as Error).message }];
        }

        for (const message of messages) {
          const messageType = String(message.headers[':message-type'] ?? 'event');
          const payload = safeJson<Record<string, unknown>>(textDecoder.decode(message.payload)) ?? {};

          if (messageType === 'exception' || messageType === 'error') {
            const kind = String(message.headers[':exception-type'] ?? message.headers[':error-code'] ?? 'Error');
            const detail = String(payload.message ?? payload.Message ?? message.headers[':error-message'] ?? '');
            events.push({ type: 'error', message: detail ? `${kind}: ${detail}` : kind });
            continue;
          }

          switch (message.headers[':event-type']) {
            case 'contentBlockDelta': {
              const text = (payload.delta as { text?: string } | undefined)?.text;
              if (text) events.push({ type: 'delta', content: text });
              break;
            }
            case 'messageStop': {
              const reason = payload.stopReason as string | undefined;
              if (reason) events.push({ type: 'finish', reason });
              break;
            }
            case 'metadata': {
              const usage = payload.usage as ConverseUsage | undefined;
              if (usage) events.push(usageEvent(usage));
              break;
            }
            default:
              break;
          }
        }
        return events;
      },
      flush() {
        return frames.pendingBytes > 0
          ? [{ type: 'error', message: 'The Bedrock stream ended in the middle of an event.' }]
          : [];
      },
    };
  },

  parseNonStreamResponse(payload: unknown) {
    const body = payload as {
      output?: { message?: { content?: Array<{ text?: string }> } };
      stopReason?: string;
      usage?: ConverseUsage;
    };

    const content = (body.output?.message?.content ?? []).map((block) => block.text ?? '').join('');
    const events: AdapterEvent[] = [{ type: 'delta', content }];
    if (body.stopReason) events.push({ type: 'finish', reason: body.stopReason });
    if (body.usage) events.push(usageEvent(body.usage));
    return events;
  },

  parseErrorPayload(payload: unknown, status: number, headers?: Headers) {
    const body = payload as { message?: string; Message?: string };
    const detail = body?.message ?? body?.Message;
    // e.g. "ValidationException:http://internal.amazon.com/coral/com.amazon.bedrock/"
    const errorType = headers?.get('x-amzn-errortype')?.split(':')[0];
    if (detail && errorType) return `${errorType}: ${detail}`;
    return detail ?? errorType ?? `Bedrock returned HTTP ${status}.`;
  },
};
