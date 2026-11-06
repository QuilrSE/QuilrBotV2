import type { Adapter, UpstreamRequest } from './types';
import type { AdapterEvent } from '../types';
import { createSseDecoder, safeJson } from './sse';
import { validMaxTokens } from './anthropicAdapter';

interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenAiChunk {
  model?: string;
  choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
  usage?: OpenAiUsage | null;
  error?: { message?: string } | string;
}

function usageEvent(usage: OpenAiUsage): AdapterEvent {
  return {
    type: 'usage',
    usage: { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens },
  };
}

function errorText(error: OpenAiChunk['error']): string | undefined {
  if (!error) return undefined;
  return typeof error === 'string' ? error : error.message;
}

/**
 * Adapter for every upstream that speaks the OpenAI /chat/completions
 * dialect: OpenAI, Azure OpenAI (v1 and legacy), Google Gemini, Mistral,
 * Cohere, Groq, DeepSeek, OpenRouter, and any Enterprise LLM Gateway that
 * forwards OpenAI-shaped requests.
 */
export const openaiAdapter: Adapter = {
  buildBody(request: UpstreamRequest) {
    const messages = request.messages.map(({ role, content }) => ({ role, content }));
    if (request.systemPrompt?.trim()) {
      messages.unshift({ role: 'system', content: request.systemPrompt.trim() });
    }

    return {
      model: request.model,
      messages,
      stream: request.stream,
      // Without this, OpenAI-compatible APIs never report token usage on streamed replies.
      ...(request.stream && request.includeStreamUsage ? { stream_options: { include_usage: true } } : {}),
      ...(request.maxTokensField ? { [request.maxTokensField]: validMaxTokens(request.maxTokens) } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    };
  },

  createStreamDecoder() {
    return createSseDecoder((data) => {
      if (data === '[DONE]') return [];
      const payload = safeJson<OpenAiChunk>(data);
      if (!payload) return [];

      const events: AdapterEvent[] = [];
      const message = errorText(payload.error);
      if (message) events.push({ type: 'error', message });
      if (payload.model) events.push({ type: 'model', model: payload.model });

      const choice = payload.choices?.[0];
      if (choice?.delta?.content) events.push({ type: 'delta', content: choice.delta.content });
      if (choice?.finish_reason) events.push({ type: 'finish', reason: choice.finish_reason });
      if (payload.usage) events.push(usageEvent(payload.usage));
      return events;
    });
  },

  parseNonStreamResponse(payload: unknown) {
    const body = payload as {
      model?: string;
      choices?: Array<{
        message?: { content?: string | Array<{ type?: string; text?: string }> | null };
        finish_reason?: string | null;
      }>;
      usage?: OpenAiUsage;
    };

    const choice = body.choices?.[0];
    const raw = choice?.message?.content;
    const content = Array.isArray(raw) ? raw.map((part) => part.text ?? '').join('') : raw ?? '';

    const events: AdapterEvent[] = [{ type: 'delta', content }];
    if (body.model) events.push({ type: 'model', model: body.model });
    if (choice?.finish_reason) events.push({ type: 'finish', reason: choice.finish_reason });
    if (body.usage) events.push(usageEvent(body.usage));
    return events;
  },

  parseErrorPayload(payload: unknown, status: number) {
    const body = payload as { error?: { message?: string; code?: string } | string; message?: string; detail?: string };
    return errorText(body?.error) ?? body?.message ?? body?.detail ?? `Upstream returned HTTP ${status}.`;
  },
};
