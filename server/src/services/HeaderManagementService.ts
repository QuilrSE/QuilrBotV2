import type { AuthHeaderStyle, HeaderEntry } from '../types';
import { headerEntriesToObject } from '../utils/headers';

/**
 * Centralizes every rule about *how* a credential or custom header is
 * attached to an upstream request, so no other module needs to know the
 * difference between "Bearer", "x-api-key", or a fully custom header name.
 */
export const HeaderManagementService = {
  buildAuthHeaders(style: AuthHeaderStyle, apiKey: string | undefined, fieldName?: string): Record<string, string> {
    if (!apiKey) return {};

    switch (style) {
      case 'bearer':
        return { Authorization: `Bearer ${apiKey}` };
      case 'x-api-key':
        return { 'x-api-key': apiKey };
      case 'api-key-header':
        return { [fieldName ?? 'api-key']: apiKey };
      // 'aws' is resolved in ChatService (Bearer API key or SigV4 signing).
      case 'aws':
      case 'none':
      default:
        return {};
    }
  },

  buildGatewayAuthHeaders(
    method: 'bearer' | 'header' | 'none',
    apiKey: string | undefined,
    headerName?: string,
  ): Record<string, string> {
    if (!apiKey || method === 'none') return {};
    if (method === 'bearer') return { Authorization: `Bearer ${apiKey}` };
    if (method === 'header' && headerName?.trim()) return { [headerName.trim()]: apiKey };
    return {};
  },

  mergeHeaders(...groups: Array<Record<string, string> | undefined>): Record<string, string> {
    return Object.assign({}, ...groups.filter(Boolean));
  },

  fromEntries(entries: HeaderEntry[] | undefined): Record<string, string> {
    return headerEntriesToObject(entries);
  },

  validateEntries(entries: HeaderEntry[] | undefined): string | null {
    if (!entries) return null;
    const seen = new Set<string>();
    for (const entry of entries) {
      const name = entry.name.trim();
      if (!entry.enabled || !name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) return `Duplicate header name: "${name}".`;
      seen.add(key);
    }
    return null;
  },
};
