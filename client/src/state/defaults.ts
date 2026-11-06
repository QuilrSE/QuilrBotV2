import { createId } from '../utils/id';
import type { Conversation, GatewayConnectionState, ProviderConnectionState } from '../types';

export const DEFAULT_PROVIDER_CONNECTION: ProviderConnectionState = {
  providerId: 'openai',
  apiKey: '',
  model: 'gpt-6-sol',
  baseUrlOverride: '',
  apiVersion: '',
  region: '',
  awsAuthMode: 'api-key',
  awsAccessKeyId: '',
  awsSecretAccessKey: '',
  awsSessionToken: '',
  headers: [],
};

export const DEFAULT_GATEWAY_CONNECTION: GatewayConnectionState = {
  name: 'My Gateway',
  baseUrl: '',
  endpointPath: '/chat/completions',
  model: '',
  maxTokensField: 'max_tokens',
  apiStyle: 'openai',
  authMethod: 'bearer',
  authHeaderName: '',
  apiKey: '',
  headers: [
    { id: createId(), name: 'x-customer-id', value: '', enabled: true },
    { id: createId(), name: 'x-department', value: '', enabled: true },
  ],
};

/** Fields that are secrets: kept in memory only, never written to localStorage. */
export const PROVIDER_SECRET_FIELDS = ['apiKey', 'awsSecretAccessKey', 'awsSessionToken'] as const;

export const DEFAULT_SYSTEM_PROMPT = 'You are a concise, helpful AI assistant.';

export function createConversation(title = 'New chat'): Conversation {
  const now = Date.now();
  return { id: createId(), title, messages: [], createdAt: now, updatedAt: now };
}
