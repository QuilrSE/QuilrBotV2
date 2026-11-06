import { apiDelete, apiGet, apiPost } from './api';
import type { ProviderDefinition, RevealedProviderProfile, SavedProviderProfile } from '../types';

/** Thin client-side wrapper matching the server's ProviderService surface. */
export const ProviderService = {
  getCatalog(): Promise<{ providers: ProviderDefinition[] }> {
    return apiGet('/providers/catalog');
  },
  listSaved(): Promise<{ profiles: SavedProviderProfile[] }> {
    return apiGet('/providers/saved');
  },
  save(profile: Record<string, unknown>): Promise<{ profile: SavedProviderProfile }> {
    return apiPost('/providers/saved', profile);
  },
  remove(id: string): Promise<{ deleted: boolean }> {
    return apiDelete(`/providers/saved/${id}`);
  },
  reveal(id: string): Promise<{ profile: RevealedProviderProfile }> {
    return apiGet(`/providers/saved/${id}/reveal`);
  },
};
