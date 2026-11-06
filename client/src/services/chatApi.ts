import type { ChatMessage, DoneMeta, GuardrailVerdict, NormalizedStreamEvent } from '../types';

export interface ChatStreamPayload {
  mode: 'provider' | 'gateway';
  model: string;
  provider?: Record<string, unknown>;
  gateway?: Record<string, unknown>;
  messages: Array<{ role: ChatMessage['role']; content: string }>;
  systemPrompt?: string;
  stream: boolean;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface StreamHandlers {
  onDelta(content: string): void;
  onDone(meta: DoneMeta): void;
  onError(message: string, status?: number, verdict?: GuardrailVerdict): void;
}

/**
 * ChatService (client): opens the streaming connection to QuilrBot's own
 * `/api/chat/stream` relay and demultiplexes the normalized SSE protocol
 * into UI-friendly callbacks. The relay — not the browser — talks to the
 * upstream provider or gateway, so the browser never needs CORS access to
 * an LLM API and credentials never cross origins.
 */
export const ChatService = {
  async streamChat(payload: ChatStreamPayload, handlers: StreamHandlers, signal?: AbortSignal): Promise<void> {
    let response: Response;
    try {
      response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        handlers.onError('Stopped.', undefined, 'failed');
        return;
      }
      handlers.onError('Could not reach the QuilrBot relay. Check that the server is running on port 4501.', undefined, 'failed');
      return;
    }

    if (!response.ok || !response.body) {
      let message = `Request failed with HTTP ${response.status}.`;
      try {
        const body = await response.json();
        message = body?.error?.message ?? message;
      } catch {
        // ignore
      }
      handlers.onError(message, response.status, 'failed');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finished = false;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const line = frame.split('\n').find((entry) => entry.startsWith('data:'));
          if (!line) continue;
          let event: NormalizedStreamEvent;
          try {
            event = JSON.parse(line.slice(5).trim()) as NormalizedStreamEvent;
          } catch {
            continue;
          }

          if (event.type === 'delta') {
            handlers.onDelta(event.content);
          } else if (event.type === 'done') {
            finished = true;
            const { type: _type, ...meta } = event;
            handlers.onDone(meta);
          } else if (event.type === 'error') {
            finished = true;
            handlers.onError(event.message, event.status, event.verdict ?? 'failed');
          }
        }
      }
      if (!finished) handlers.onError('The relay closed the stream without finishing the reply.', undefined, 'failed');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        handlers.onError('Stopped.', undefined, 'failed');
      } else {
        handlers.onError('The connection to the QuilrBot relay was interrupted.', undefined, 'failed');
      }
    }
  },
};
