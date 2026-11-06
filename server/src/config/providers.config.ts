// ============================================================================
// QuilrBot — Provider Registry
//
// This file is the ONLY place a direct LLM provider is registered. Every
// provider is a plain configuration object; no provider-specific branching
// exists anywhere else in the codebase. To add a new provider, add an entry
// here (and, optionally, a default credential env var in `.env`).
//
// Every provider below is reachable through one of three wire adapters:
//   - "openai"           : OpenAI-compatible /chat/completions
//   - "anthropic"        : Anthropic Messages API (/v1/messages)
//   - "bedrock-converse" : Amazon Bedrock Converse / ConverseStream
//
// Model lists are suggestions shown in the UI, not an allow-list — any model
// id the upstream accepts can be typed in. Verified against provider docs in
// November 2026; see docs/PROVIDER_ENDPOINTS.md for sources and notes.
// ============================================================================

import type { ProviderDefinition } from '../types';

export const BEDROCK_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-2',
  'ca-central-1',
  'sa-east-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-north-1',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
];

export const PROVIDER_REGISTRY: ProviderDefinition[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT models via the native OpenAI Chat Completions API.',
    apiStyle: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    chatPath: '/chat/completions',
    authHeaderStyle: 'bearer',
    defaultModels: ['gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5.6-terra', 'gpt-5.5'],
    docsUrl: 'https://developers.openai.com/api/docs/models/all',
    allowsBaseUrlOverride: true,
    supportsStreaming: true,
    streamUsageOption: true,
    // GPT-5+ and reasoning models reject the legacy max_tokens field.
    maxTokensField: 'max_completion_tokens',
  },
  {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    description:
      'Models deployed on an Azure OpenAI / Foundry resource. Paste the resource endpoint to use the v1 API, or a full deployment URL for legacy api-version calls.',
    apiStyle: 'openai',
    defaultBaseUrl: '',
    chatPath: '/chat/completions',
    endpointStyle: 'azure-openai',
    authHeaderStyle: 'api-key-header',
    authFieldName: 'api-key',
    defaultModels: ['gpt-6-sol', 'gpt-5.5', 'gpt-5.4-mini'],
    docsUrl: 'https://learn.microsoft.com/azure/ai-foundry/openai/api-version-lifecycle',
    allowsBaseUrlOverride: true,
    supportsStreaming: true,
    streamUsageOption: true,
    maxTokensField: 'max_completion_tokens',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude models via the native Anthropic Messages API.',
    apiStyle: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    chatPath: '/messages',
    authHeaderStyle: 'x-api-key',
    defaultModels: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'],
    docsUrl: 'https://docs.claude.com/en/api/messages',
    staticHeaders: { 'anthropic-version': '2023-06-01' },
    allowsBaseUrlOverride: false,
    supportsStreaming: true,
  },
  {
    id: 'aws-bedrock',
    label: 'AWS Bedrock',
    description:
      'Any Bedrock model through the Converse API. Authenticate with a Bedrock API key or IAM access keys (SigV4).',
    apiStyle: 'bedrock-converse',
    defaultBaseUrl: 'https://bedrock-runtime.{region}.amazonaws.com',
    chatPath: '/model/{model}/converse',
    streamChatPath: '/model/{model}/converse-stream',
    authHeaderStyle: 'aws',
    defaultModels: [
      'global.anthropic.claude-opus-5-5',
      'us.anthropic.claude-sonnet-5',
      'in.anthropic.claude-sonnet-5',
      'us.anthropic.claude-sonnet-4-6',
      'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      'us.amazon.nova-pro-v1:0',
    ],
    docsUrl: 'https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html',
    // A VPC interface endpoint (PrivateLink) can stand in for the public one.
    allowsBaseUrlOverride: true,
    supportsStreaming: true,
    regions: BEDROCK_REGIONS,
    defaultRegion: 'us-east-1',
  },
  {
    id: 'google-gemini',
    label: 'Google Gemini',
    description: 'Gemini models via Google’s OpenAI-compatible endpoint.',
    apiStyle: 'openai',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    chatPath: '/chat/completions',
    authHeaderStyle: 'bearer',
    defaultModels: ['gemini-3.1-pro-preview', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'],
    docsUrl: 'https://ai.google.dev/gemini-api/docs/openai',
    allowsBaseUrlOverride: false,
    supportsStreaming: true,
    streamUsageOption: true,
  },
  {
    id: 'mistral',
    label: 'Mistral',
    description: 'Mistral’s hosted models via their chat completions endpoint.',
    apiStyle: 'openai',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    chatPath: '/chat/completions',
    authHeaderStyle: 'bearer',
    defaultModels: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest'],
    docsUrl: 'https://docs.mistral.ai/api/',
    allowsBaseUrlOverride: false,
    supportsStreaming: true,
  },
  {
    id: 'cohere',
    label: 'Cohere',
    description: 'Command models via Cohere’s OpenAI-compatible endpoint.',
    apiStyle: 'openai',
    defaultBaseUrl: 'https://api.cohere.ai/compatibility/v1',
    chatPath: '/chat/completions',
    authHeaderStyle: 'bearer',
    defaultModels: ['command-a-plus-05-2026', 'command-a-03-2025', 'command-r7b-12-2024'],
    docsUrl: 'https://docs.cohere.com/docs/compatibility-api',
    allowsBaseUrlOverride: false,
    supportsStreaming: true,
  },
  {
    id: 'groq',
    label: 'Groq',
    description: 'Low-latency inference via Groq’s OpenAI-compatible endpoint.',
    apiStyle: 'openai',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    chatPath: '/chat/completions',
    authHeaderStyle: 'bearer',
    defaultModels: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'],
    docsUrl: 'https://console.groq.com/docs/models',
    allowsBaseUrlOverride: false,
    supportsStreaming: true,
    streamUsageOption: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    description: 'DeepSeek models via their OpenAI-compatible endpoint.',
    apiStyle: 'openai',
    defaultBaseUrl: 'https://api.deepseek.com',
    chatPath: '/chat/completions',
    authHeaderStyle: 'bearer',
    defaultModels: ['deepseek-flash', 'deepseek-v4-pro'],
    docsUrl: 'https://api-docs.deepseek.com/',
    allowsBaseUrlOverride: false,
    supportsStreaming: true,
    streamUsageOption: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Unified access to many hosted models via OpenRouter.',
    apiStyle: 'openai',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    chatPath: '/chat/completions',
    authHeaderStyle: 'bearer',
    defaultModels: ['openrouter/auto', 'anthropic/claude-opus-4.8', 'openai/gpt-oss-120b'],
    docsUrl: 'https://openrouter.ai/docs',
    allowsBaseUrlOverride: false,
    supportsStreaming: true,
    streamUsageOption: true,
    // Claude models behind OpenRouter require an output cap.
    maxTokensField: 'max_tokens',
  },
];

export function getProviderDefinition(providerId: string): ProviderDefinition | undefined {
  return PROVIDER_REGISTRY.find((provider) => provider.id === providerId);
}
