import { v4 as uuid } from 'uuid';
import { jsonStore } from '../storage/jsonStore';
import { encryptSecret, decryptSecret } from '../storage/crypto';
import type { GatewayConfig, SavedGatewayProfile } from '../types';

/** CRUD for saved Enterprise LLM Gateway connection profiles. */
export const GatewayService = {
  listSavedProfiles(): Array<Omit<SavedGatewayProfile, 'apiKey'> & { hasApiKey: boolean }> {
    return jsonStore.read().gateways.map(({ apiKey, ...rest }) => ({
      ...rest,
      hasApiKey: Boolean(apiKey),
    }));
  },

  getSavedProfileWithSecret(id: string): SavedGatewayProfile | undefined {
    const profile = jsonStore.read().gateways.find((entry) => entry.id === id);
    if (!profile) return undefined;
    return { ...profile, apiKey: profile.apiKey ? decryptSecret(profile.apiKey) : '' };
  },

  saveProfile(input: GatewayConfig): SavedGatewayProfile {
    return jsonStore.update((store) => {
      const now = Date.now();
      const encryptedKey = input.apiKey ? encryptSecret(input.apiKey) : '';

      if (input.id) {
        const index = store.gateways.findIndex((entry) => entry.id === input.id);
        if (index >= 0) {
          store.gateways[index] = {
            ...store.gateways[index],
            ...input,
            apiKey: encryptedKey || store.gateways[index].apiKey,
            updatedAt: now,
          };
          return store.gateways[index];
        }
      }

      const created: SavedGatewayProfile = {
        id: uuid(),
        name: input.name,
        baseUrl: input.baseUrl,
        endpointPath: input.endpointPath,
        model: input.model,
        maxTokensField: input.maxTokensField,
        apiStyle: input.apiStyle,
        authMethod: input.authMethod,
        authHeaderName: input.authHeaderName,
        headers: input.headers ?? [],
        apiKey: encryptedKey,
        createdAt: now,
        updatedAt: now,
      };
      store.gateways.push(created);
      return created;
    });
  },

  deleteProfile(id: string): boolean {
    return jsonStore.update((store) => {
      const before = store.gateways.length;
      store.gateways = store.gateways.filter((entry) => entry.id !== id);
      return store.gateways.length < before;
    });
  },
};
