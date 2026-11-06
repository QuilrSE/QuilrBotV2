import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return value.trim().toLowerCase() === 'true';
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function read(name: string): string {
  return (process.env[name] ?? '').trim();
}

export const env = {
  serverPort: toInt(process.env.QUILRBOT_SERVER_PORT, 4501),
  clientPort: toInt(process.env.QUILRBOT_CLIENT_PORT, 4500),
  allowedOrigin: process.env.QUILRBOT_ALLOWED_ORIGIN ?? 'http://localhost:4500',
  storePath: process.env.QUILRBOT_STORE_PATH ?? './data/store.json',
  encryptionKey: process.env.QUILRBOT_ENCRYPTION_KEY ?? '',
  defaultTimeoutMs: toInt(process.env.QUILRBOT_DEFAULT_TIMEOUT_MS, 60000),
  defaultStreaming: toBool(process.env.QUILRBOT_DEFAULT_STREAMING, true),
  defaultMaxTokens: toInt(process.env.QUILRBOT_DEFAULT_MAX_TOKENS, 4096),
  debugMode: toBool(process.env.QUILRBOT_DEBUG_MODE, false),

  /**
   * Server-side fallback credentials, keyed by provider id. When a chat
   * request arrives without a key, the relay uses these instead, so a team
   * can run QuilrBot on a box that already holds credentials without ever
   * typing them into the browser.
   */
  defaultProviderKeys: {
    openai: read('OPENAI_API_KEY'),
    'azure-openai': read('AZURE_OPENAI_API_KEY'),
    anthropic: read('ANTHROPIC_API_KEY'),
    'aws-bedrock': read('AWS_BEARER_TOKEN_BEDROCK'),
    'google-gemini': read('GOOGLE_GEMINI_API_KEY'),
    mistral: read('MISTRAL_API_KEY'),
    cohere: read('COHERE_API_KEY'),
    groq: read('GROQ_API_KEY'),
    deepseek: read('DEEPSEEK_API_KEY'),
    openrouter: read('OPENROUTER_API_KEY'),
  } as Record<string, string>,

  /** Default base URLs for providers that have no fixed public endpoint. */
  defaultProviderBaseUrls: {
    'azure-openai': read('AZURE_OPENAI_ENDPOINT'),
  } as Record<string, string>,

  /** Standard AWS env vars, used for Bedrock IAM (SigV4) mode when the browser sends no keys. */
  aws: {
    accessKeyId: read('AWS_ACCESS_KEY_ID'),
    secretAccessKey: read('AWS_SECRET_ACCESS_KEY'),
    sessionToken: read('AWS_SESSION_TOKEN'),
    region: read('AWS_REGION') || read('AWS_DEFAULT_REGION'),
  },
};
