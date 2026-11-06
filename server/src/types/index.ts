// ============================================================================
// QuilrBot Server — Shared Type Definitions
// ============================================================================

/** The wire format QuilrBot normalizes every upstream provider into. */
export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * Every upstream integration speaks one of these request/response dialects.
 *   - openai           : /chat/completions (OpenAI, Azure v1, Gemini, Mistral, Cohere, Groq, DeepSeek, OpenRouter, gateways)
 *   - anthropic        : Anthropic Messages API (/v1/messages)
 *   - bedrock-converse : Amazon Bedrock Converse / ConverseStream (model-agnostic)
 */
export type ApiStyle = 'openai' | 'anthropic' | 'bedrock-converse';

/**
 * How the upstream expects the credential to be transmitted.
 *   - aws : Bedrock. Either a Bedrock API key (sent as a Bearer token) or IAM
 *           access keys (the request is SigV4-signed). Chosen per connection.
 */
export type AuthHeaderStyle = 'bearer' | 'api-key-header' | 'x-api-key' | 'aws' | 'none';

/**
 * How the final request URL is derived from the base URL.
 *   - standard     : baseUrl + chatPath (both may contain {region} / {model} placeholders)
 *   - azure-openai : accepts either an Azure resource endpoint (→ /openai/v1/chat/completions,
 *                    the GA v1 API) or a legacy full deployment URL (→ requires ?api-version=)
 */
export type EndpointStyle = 'standard' | 'azure-openai';

export type AwsAuthMode = 'api-key' | 'iam';

/**
 * A ProviderDefinition is a pure configuration object. Registering a new
 * direct LLM provider never requires touching adapter or service code —
 * only an entry in `config/providers.config.ts`.
 */
export interface ProviderDefinition {
  id: string;
  label: string;
  description: string;
  apiStyle: ApiStyle;
  /** May contain `{region}`. Empty when the user must supply a base URL. */
  defaultBaseUrl: string;
  /** Path for non-streaming calls. May contain `{model}` (URL-encoded on substitution). */
  chatPath: string;
  /** Path for streaming calls when it differs from `chatPath` (e.g. Bedrock /converse-stream). */
  streamChatPath?: string;
  endpointStyle?: EndpointStyle;
  authHeaderStyle: AuthHeaderStyle;
  /** Name of the header used for auth, when not a plain Bearer token. */
  authFieldName?: string;
  defaultModels: string[];
  docsUrl?: string;
  /** Extra static headers always sent for this provider (e.g. anthropic-version). */
  staticHeaders?: Record<string, string>;
  /** Whether this provider supports a user-supplied base URL override. */
  allowsBaseUrlOverride: boolean;
  supportsStreaming: boolean;
  /** Send `stream_options: { include_usage: true }` so streamed replies report token usage. */
  streamUsageOption?: boolean;
  /** OpenAI dialect only: field used to cap output tokens. Omitted → no cap is sent. */
  maxTokensField?: 'max_tokens' | 'max_completion_tokens';
  /** When set, the connection form shows a region picker with these values. */
  regions?: string[];
  defaultRegion?: string;
  /** Set at runtime by the catalog endpoint: the server has a credential for this provider in its env. */
  hasServerCredentials?: boolean;
  /** Set at runtime: the server has a default base URL for this provider (e.g. AZURE_OPENAI_ENDPOINT). */
  hasServerBaseUrl?: boolean;
}

export type ConnectionMode = 'provider' | 'gateway';

export type GatewayAuthMethod = 'bearer' | 'header' | 'none';

export type GatewayMaxTokensField = 'max_tokens' | 'max_completion_tokens' | 'none';

/** Wire format a gateway endpoint expects. */
export type GatewayApiStyle = 'openai' | 'anthropic';

export interface HeaderEntry {
  name: string;
  value: string;
  enabled: boolean;
}

export interface GatewayConfig {
  id?: string;
  name: string;
  baseUrl: string;
  endpointPath: string;
  /** Model the gateway routes to (saved with the profile for convenience). */
  model?: string;
  /**
   * Which field carries the output-token cap. Gateways fronting Claude (e.g. LiteLLM →
   * Anthropic / Bedrock) require max_tokens; some OpenAI-only gateways prefer
   * max_completion_tokens. Defaults to max_tokens.
   */
  maxTokensField?: GatewayMaxTokensField;
  /**
   * openai    : POST …/chat/completions, system prompt as the first message.
   * anthropic : POST …/v1/messages, top-level `system`, `max_tokens` required.
   * When omitted, inferred from the endpoint path.
   */
  apiStyle?: GatewayApiStyle;
  authMethod: GatewayAuthMethod;
  authHeaderName?: string;
  apiKey?: string;
  headers: HeaderEntry[];
}

export interface AwsCredentials {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

export interface ProviderConnectionConfig {
  id?: string;
  providerId: string;
  label?: string;
  /** For Bedrock in api-key mode, this is the Bedrock API key. */
  apiKey?: string;
  model: string;
  baseUrlOverride?: string;
  /** Azure legacy deployment URLs only. Ignored by the v1 API. */
  apiVersion?: string;
  region?: string;
  awsAuthMode?: AwsAuthMode;
  aws?: AwsCredentials;
  headers?: HeaderEntry[];
}

export interface ChatRequestBody {
  mode: ConnectionMode;
  /** Model identifier to request, valid for both provider and gateway modes. */
  model: string;
  provider?: ProviderConnectionConfig;
  gateway?: GatewayConfig;
  messages: ChatMessage[];
  systemPrompt?: string;
  stream?: boolean;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface NormalizedUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * Outcome of a request as seen through a guardrail lens.
 *   - allowed : the model answered normally
 *   - blocked : a gateway, guardrail, or the model's own safety system stopped it
 *   - failed  : something else went wrong (bad key, network, timeout, bad model id)
 */
export type GuardrailVerdict = 'allowed' | 'blocked' | 'failed';

/** Events an adapter decodes out of an upstream response. ChatService aggregates them. */
export type AdapterEvent =
  | { type: 'delta'; content: string }
  | { type: 'usage'; usage: NormalizedUsage }
  | { type: 'model'; model: string }
  | { type: 'finish'; reason: string }
  | { type: 'error'; message: string };

/** The normalized protocol QuilrBot's relay streams to the browser over SSE. */
export type NormalizedStreamEvent =
  | { type: 'delta'; content: string }
  | {
      type: 'done';
      usage?: NormalizedUsage;
      model?: string;
      finishReason?: string;
      verdict: GuardrailVerdict;
      latencyMs?: number;
    }
  | { type: 'error'; message: string; status?: number; verdict: GuardrailVerdict };

export interface AppSettings {
  general: {
    theme: 'dark' | 'light';
    language: string;
  };
  advanced: {
    requestTimeoutMs: number;
    streamingEnabled: boolean;
    debugMode: boolean;
    maxTokens: number;
  };
  defaultGatewayId?: string;
}

export interface SavedProviderProfile extends ProviderConnectionConfig {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface SavedGatewayProfile extends GatewayConfig {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoreShape {
  providers: SavedProviderProfile[];
  gateways: SavedGatewayProfile[];
  settings: AppSettings;
}
