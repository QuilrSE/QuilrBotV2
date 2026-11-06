import type { AdapterEvent, ChatMessage } from '../types';

export interface UpstreamRequest {
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream: boolean;
  /** OpenAI dialect: ask the upstream to include token usage in the final stream chunk. */
  includeStreamUsage?: boolean;
  /** OpenAI dialect: which field carries the output-token cap (omitted when undefined). */
  maxTokensField?: 'max_tokens' | 'max_completion_tokens';
}

/** Incrementally turns raw upstream bytes into normalized adapter events. */
export interface StreamDecoder {
  push(chunk: Uint8Array): AdapterEvent[];
  flush(): AdapterEvent[];
}

export interface Adapter {
  /** Builds the upstream-native JSON body for this dialect. */
  buildBody(request: UpstreamRequest): Record<string, unknown>;
  /** Creates a fresh decoder for one streaming response. */
  createStreamDecoder(): StreamDecoder;
  /** Parses a full non-streaming JSON response. */
  parseNonStreamResponse(payload: unknown): AdapterEvent[];
  /** Turns an upstream error response into a human-readable message. */
  parseErrorPayload(payload: unknown, status: number, headers?: Headers): string;
}
