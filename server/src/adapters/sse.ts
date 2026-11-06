import type { AdapterEvent } from '../types';
import type { StreamDecoder } from './types';

/**
 * Shared Server-Sent Events framing for the text-based dialects (OpenAI,
 * Anthropic). Decodes UTF-8 with `stream: true` so a multi-byte character
 * split across two network chunks is never corrupted, and hands each `data:`
 * payload to the dialect-specific parser.
 */
export function createSseDecoder(onData: (data: string) => AdapterEvent[]): StreamDecoder {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  function drainLines(final: boolean): AdapterEvent[] {
    const events: AdapterEvent[] = [];
    const lines = buffer.split(/\r?\n/);
    buffer = final ? '' : lines.pop() ?? '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data) events.push(...onData(data));
    }
    return events;
  }

  return {
    push(chunk) {
      buffer += decoder.decode(chunk, { stream: true });
      return drainLines(false);
    },
    flush() {
      buffer += decoder.decode();
      return drainLines(true);
    },
  };
}

export function safeJson<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}
