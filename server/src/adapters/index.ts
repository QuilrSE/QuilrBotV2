import type { ApiStyle } from '../types';
import type { Adapter } from './types';
import { openaiAdapter } from './openaiAdapter';
import { anthropicAdapter } from './anthropicAdapter';
import { bedrockConverseAdapter } from './bedrockConverseAdapter';

const ADAPTERS: Record<ApiStyle, Adapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  'bedrock-converse': bedrockConverseAdapter,
};

export function getAdapter(apiStyle: ApiStyle): Adapter {
  return ADAPTERS[apiStyle];
}

export * from './types';
