/**
 * Thin, typed wrapper over localStorage. QuilrBot uses browser storage only
 * for non-secret UI preferences (active connection mode, selected provider,
 * model, theme, last-used gateway id). API keys are never written here —
 * see docs/STORAGE_DESIGN.md.
 */
const NAMESPACE = 'quilrbot:v1:';

export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(NAMESPACE + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NAMESPACE + key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private browsing, quota). Fail silently.
  }
}

export function removeLocal(key: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(NAMESPACE + key);
}
