// ============================================================================
// QuilrBot Client — Shared Type Definitions
// Mirrors server/src/types/index.ts for the shapes that cross the wire.
// ============================================================================

export type ChatRole = 'system' | 'user' | 'assistant';

/** allowed: answered normally · blocked: a guardrail stopped it · failed: misconfiguration or network */
export type GuardrailVerdict = 'allowed' | 'blocked' | 'failed';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  usage?: NormalizedUsage;
  model?: string;
  isError?: boolean;
  verdict?: GuardrailVerdict;
  finishReason?: string;
  status?: number;
  latencyMs?: number;
  /** Which channel produced this message. Always set on assistant messages; unset on user messages. */
  side?: ConnectionMode;
}

export type ApiStyle = 'openai' | 'anthropic' | 'bedrock-converse';
export type AuthHeaderStyle = 'bearer' | 'api-key-header' | 'x-api-key' | 'aws' | 'none';
export type AwsAuthMode = 'api-key' | 'iam';

export interface ProviderDefinition {
  id: string;
  label: string;
  description: string;
  apiStyle: ApiStyle;
  defaultBaseUrl: string;
  chatPath: string;
  streamChatPath?: string;
  endpointStyle?: 'standard' | 'azure-openai';
  authHeaderStyle: AuthHeaderStyle;
  authFieldName?: string;
  defaultModels: string[];
  docsUrl?: string;
  staticHeaders?: Record<string, string>;
  allowsBaseUrlOverride: boolean;
  supportsStreaming: boolean;
  regions?: string[];
  defaultRegion?: string;
  hasServerCredentials?: boolean;
  hasServerBaseUrl?: boolean;
}

export type ConnectionMode = 'provider' | 'gateway';
export type GatewayAuthMethod = 'bearer' | 'header' | 'none';
export type GatewayMaxTokensField = 'max_tokens' | 'max_completion_tokens' | 'none';
export type GatewayApiStyle = 'openai' | 'anthropic';

export interface HeaderEntry {
  id: string;
  name: string;
  value: string;
  enabled: boolean;
}

export interface GatewayConnectionState {
  id?: string;
  name: string;
  baseUrl: string;
  endpointPath: string;
  /** The model id the gateway should route to — independent of the Direct Provider's model. */
  model: string;
  maxTokensField: GatewayMaxTokensField;
  apiStyle: GatewayApiStyle;
  authMethod: GatewayAuthMethod;
  authHeaderName: string;
  apiKey: string;
  headers: HeaderEntry[];
}

export interface ProviderConnectionState {
  id?: string;
  providerId: string;
  /** Provider API key, or the Bedrock API key in Bedrock api-key mode. */
  apiKey: string;
  model: string;
  baseUrlOverride: string;
  apiVersion: string;
  region: string;
  awsAuthMode: AwsAuthMode;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsSessionToken: string;
  headers: HeaderEntry[];
}

export interface NormalizedUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface DoneMeta {
  usage?: NormalizedUsage;
  model?: string;
  finishReason?: string;
  verdict: GuardrailVerdict;
  latencyMs?: number;
}

export type NormalizedStreamEvent =
  | { type: 'delta'; content: string }
  | ({ type: 'done' } & DoneMeta)
  | { type: 'error'; message: string; status?: number; verdict?: GuardrailVerdict };

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

export interface SavedProviderProfile {
  id: string;
  name: string;
  providerId: string;
  model: string;
  baseUrlOverride?: string;
  apiVersion?: string;
  region?: string;
  awsAuthMode?: AwsAuthMode;
  aws?: { accessKeyId?: string; hasSecretAccessKey?: boolean; hasSessionToken?: boolean };
  headers?: HeaderEntry[];
  hasApiKey: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RevealedProviderProfile extends Omit<SavedProviderProfile, 'aws' | 'hasApiKey'> {
  apiKey: string;
  aws?: { accessKeyId?: string; secretAccessKey?: string; sessionToken?: string };
}

export interface SavedGatewayProfile {
  id: string;
  name: string;
  baseUrl: string;
  endpointPath: string;
  model?: string;
  maxTokensField?: GatewayMaxTokensField;
  apiStyle?: GatewayApiStyle;
  authMethod: GatewayAuthMethod;
  authHeaderName?: string;
  headers?: HeaderEntry[];
  hasApiKey: boolean;
  createdAt: number;
  updatedAt: number;
}

export type NoticeKind = 'error' | 'info' | 'success';

export interface Notice {
  kind: NoticeKind;
  title: string;
  detail: string;
  status?: number;
}

export type FieldErrors = Partial<Record<string, string>>;

export interface RequestMetadataEntry {
  startedAt?: number;
  finishedAt?: number;
  model?: string;
}

export type RequestMetadata = Record<ConnectionMode, RequestMetadataEntry>;

export type StreamingState = Record<ConnectionMode, boolean>;

export type AppView = 'chat' | 'models' | 'providers' | 'gateways' | 'settings';

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
