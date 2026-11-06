import type {
  FieldErrors,
  GatewayApiStyle,
  GatewayConnectionState,
  HeaderEntry,
  ProviderConnectionState,
  ProviderDefinition,
} from '../types';

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateHeaderEntries(headers: HeaderEntry[]): string | null {
  const seen = new Set<string>();
  for (const header of headers) {
    if (!header.enabled) continue;
    const name = header.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) return `Two headers are named “${name}”. Rename or remove one.`;
    seen.add(key);
  }
  return null;
}

/** Whether the provider has no fixed public endpoint and the server doesn't supply one either. */
export function providerNeedsBaseUrl(definition: ProviderDefinition | undefined): boolean {
  return Boolean(definition?.allowsBaseUrlOverride && !definition.defaultBaseUrl && !definition.hasServerBaseUrl);
}

export function validateProviderConnection(
  state: ProviderConnectionState,
  definition: ProviderDefinition | undefined,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!definition) return { providerId: 'Choose a provider.' };

  const serverCreds = Boolean(definition.hasServerCredentials);

  if (!state.model.trim()) errors.model = 'Choose or type a model id.';

  if (definition.authHeaderStyle === 'aws') {
    if (!state.region.trim()) errors.region = 'Choose the AWS region your Bedrock models are enabled in.';
    if (!serverCreds) {
      if (state.awsAuthMode === 'api-key' && !state.apiKey.trim()) {
        errors.apiKey = 'Paste a Bedrock API key, or switch to IAM access keys.';
      }
      if (state.awsAuthMode === 'iam') {
        if (!state.awsAccessKeyId.trim()) errors.awsAccessKeyId = 'Enter the access key ID (starts with AKIA or ASIA).';
        if (!state.awsSecretAccessKey.trim()) errors.awsSecretAccessKey = 'Enter the secret access key.';
      }
    }
  } else if (definition.authHeaderStyle !== 'none' && !serverCreds && !state.apiKey.trim()) {
    errors.apiKey = `Paste your ${definition.label} API key.`;
  }

  const baseUrl = state.baseUrlOverride.trim();
  if (providerNeedsBaseUrl(definition) && !baseUrl) {
    errors.baseUrlOverride = `${definition.label} needs your endpoint URL.`;
  } else if (baseUrl && !isValidHttpUrl(baseUrl)) {
    errors.baseUrlOverride = 'Use a full URL starting with https://';
  }

  const headerError = validateHeaderEntries(state.headers);
  if (headerError) errors.headers = headerError;

  return errors;
}

/** A path ending in /messages is Anthropic's Messages API; anything else is treated as OpenAI. */
export function inferGatewayApiStyle(endpointPath: string): GatewayApiStyle {
  return /\/messages\/?$/i.test(endpointPath.split('?')[0].trim()) ? 'anthropic' : 'openai';
}

export function validateGatewayConnection(state: GatewayConnectionState): FieldErrors {
  const errors: FieldErrors = {};

  if (!state.baseUrl.trim()) {
    errors.baseUrl = 'Enter the gateway’s base URL.';
  } else if (!isValidHttpUrl(state.baseUrl.trim())) {
    errors.baseUrl = 'Use a full URL starting with https://';
  }
  if (!state.endpointPath.trim()) {
    errors.endpointPath = state.apiStyle === 'anthropic' ? 'Enter the path, e.g. /v1/messages' : 'Enter the path, e.g. /chat/completions';
  } else if (inferGatewayApiStyle(state.endpointPath) !== state.apiStyle && /\/(messages|chat\/completions)\/?$/i.test(state.endpointPath)) {
    errors.endpointPath =
      state.apiStyle === 'openai'
        ? 'This path is Anthropic’s Messages API. Set API format to Anthropic Messages.'
        : 'This path is an OpenAI chat-completions endpoint. Set API format to OpenAI Chat Completions.';
  }
  if (!state.model.trim()) errors.model = 'Enter the model id the gateway should route to.';
  if (state.authMethod === 'header' && !state.authHeaderName.trim()) {
    errors.authHeaderName = 'Name the header that carries the credential.';
  }
  if (state.authMethod !== 'none' && !state.apiKey.trim()) {
    errors.apiKey = 'Enter the gateway key or token.';
  }

  const headerError = validateHeaderEntries(state.headers);
  if (headerError) errors.headers = headerError;

  return errors;
}

export function validateMessage(value: string): string | null {
  return value.trim() ? null : 'Type a message before sending.';
}
