const SECRET_PATTERNS = ['authorization', 'api-key', 'x-api-key', 'token', 'secret', 'key', 'auth'];

export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '•'.repeat(trimmed.length);
  return `${trimmed.slice(0, 3)}${'•'.repeat(Math.max(4, trimmed.length - 6))}${trimmed.slice(-3)}`;
}

export function maskHeaderList(headers: Array<{ name: string; value: string }>): Array<{ name: string; value: string }> {
  return headers.map(({ name, value }) => {
    const shouldMask = SECRET_PATTERNS.some((pattern) => name.toLowerCase().includes(pattern));
    return { name, value: shouldMask ? maskSecret(value) : value };
  });
}
