import type { HeaderEntry } from '../types';

const SECRET_PATTERNS = ['authorization', 'api-key', 'x-api-key', 'token', 'secret', 'key', 'auth'];

/** Turns an array of {name, value, enabled} rows into a flat header object. */
export function headerEntriesToObject(entries: HeaderEntry[] | undefined): Record<string, string> {
  if (!entries) return {};
  const result: Record<string, string> = {};
  for (const entry of entries) {
    if (!entry.enabled) continue;
    const name = entry.name.trim();
    if (!name) continue;
    result[name] = entry.value;
  }
  return result;
}

/** Masks any header whose name looks secret-bearing, for safe logging/preview. */
export function maskHeaderMap(headers: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const isSecret = SECRET_PATTERNS.some((pattern) => key.toLowerCase().includes(pattern));
    masked[key] = isSecret ? maskSecret(value) : value;
  }
  return masked;
}

export function maskSecret(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '•'.repeat(trimmed.length);
  return `${trimmed.slice(0, 3)}${'•'.repeat(Math.max(4, trimmed.length - 6))}${trimmed.slice(-3)}`;
}

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function joinUrl(base: string, path: string): string {
  const normalizedBase = normalizeBaseUrl(base);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
