import type { Adapter, UpstreamRequest } from './types';
import type { AdapterEvent } from '../types';
import { createSseDecoder, safeJson } from './sse';
import { toAlternatingTurns } from './turns';

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

function inputTokens(usage: AnthropicUsage): number | undefined {
  if (usage.input_tokens === undefined) return undefined;
  return usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
}

const DEFAULT_MAX_TOKENS = 4096;

export function validMaxTokens(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : DEFAULT_MAX_TOKENS;
}

/** Adapter for the native Anthropic Messages API (/v1/messages). */
export const anthropicAdapter: Adapter = {
  buildBody(request: UpstreamRequest) {
    return {
      model: request.model,
      messages: toAlternatingTurns(request.messages),
      stream: request.stream,
      // Required by the Messages API, and must be a positive integer.
      max_tokens: validMaxTokens(request.maxTokens),
      ...(request.systemPrompt?.trim() ? { system: request.systemPrompt.trim() } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    };
  },

  createStreamDecoder() {
    return createSseDecoder((data) => {
      const payload = safeJson<{
        type?: string;
        message?: { model?: string; usage?: AnthropicUsage };
        delta?: { type?: string; text?: string; stop_reason?: string | null };
        usage?: AnthropicUsage;
        error?: { type?: string; message?: string };
      }>(data);
      if (!payload) return [];

      switch (payload.type) {
        case 'message_start': {
          const events: AdapterEvent[] = [];
          if (payload.message?.model) events.push({ type: 'model', model: payload.message.model });
          // Input tokens arrive here, not in message_delta.
          if (payload.message?.usage) {
            events.push({ type: 'usage', usage: { promptTokens: inputTokens(payload.message.usage) } });
          }
          return events;
        }
        case 'content_block_delta':
          // Only surface visible text; thinking / signature deltas are skipped.
          return payload.delta?.type === 'text_delta' && payload.delta.text
            ? [{ type: 'delta', content: payload.delta.text }]
            : [];
        case 'message_delta': {
          const events: AdapterEvent[] = [];
          if (payload.delta?.stop_reason) events.push({ type: 'finish', reason: payload.delta.stop_reason });
          if (payload.usage) {
            events.push({ type: 'usage', usage: { completionTokens: payload.usage.output_tokens } });
          }
          return events;
        }
        case 'error':
          return [{ type: 'error', message: payload.error?.message ?? 'The upstream stream reported an error.' }];
        default:
          return [];
      }
    });
  },

  parseNonStreamResponse(payload: unknown) {
    const body = payload as {
      content?: Array<{ type?: string; text?: string }>;
      model?: string;
      stop_reason?: string;
      usage?: AnthropicUsage;
    };

    const content = (body.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');

    const events: AdapterEvent[] = [{ type: 'delta', content }];
    if (body.model) events.push({ type: 'model', model: body.model });
    if (body.stop_reason) events.push({ type: 'finish', reason: body.stop_reason });
    if (body.usage) {
      events.push({
        type: 'usage',
        usage: { promptTokens: inputTokens(body.usage), completionTokens: body.usage.output_tokens },
      });
    }
    return events;
  },

  parseErrorPayload(payload: unknown, status: number) {
    const body = payload as { error?: { message?: string } };
    return body?.error?.message ?? `Upstream returned HTTP ${status}.`;
  },
};
