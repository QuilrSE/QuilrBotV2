import { createId } from '../utils/id';
import type { HeaderEntry } from '../types';

/**
 * Client-side counterpart to the server's HeaderManagementService: owns the
 * add/remove/toggle/serialize lifecycle for the dynamic custom-header list
 * used in both the Direct Provider and Gateway connection forms.
 */
export const HeaderManagementService = {
  empty(): HeaderEntry[] {
    return [];
  },

  add(headers: HeaderEntry[], name = '', value = ''): HeaderEntry[] {
    return [...headers, { id: createId(), name, value, enabled: true }];
  },

  remove(headers: HeaderEntry[], id: string): HeaderEntry[] {
    return headers.filter((header) => header.id !== id);
  },

  update(headers: HeaderEntry[], id: string, patch: Partial<HeaderEntry>): HeaderEntry[] {
    return headers.map((header) => (header.id === id ? { ...header, ...patch } : header));
  },

  toRecord(headers: HeaderEntry[]): Record<string, string> {
    const record: Record<string, string> = {};
    for (const header of headers) {
      const name = header.name.trim();
      if (!header.enabled || !name) continue;
      record[name] = header.value;
    }
    return record;
  },
};
