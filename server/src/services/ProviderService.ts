import { v4 as uuid } from 'uuid';
import { jsonStore } from '../storage/jsonStore';
import { encryptSecret, decryptSecret } from '../storage/crypto';
import { PROVIDER_REGISTRY, getProviderDefinition } from '../config/providers.config';
import { env } from '../config/env';
import type { ProviderDefinition, SavedProviderProfile, ProviderConnectionConfig } from '../types';

type PublicProfile = Omit<SavedProviderProfile, 'apiKey' | 'aws'> & {
  hasApiKey: boolean;
  aws?: { accessKeyId?: string; hasSecretAccessKey: boolean; hasSessionToken: boolean };
};

function hasServerCredentials(definition: ProviderDefinition): boolean {
  if (definition.authHeaderStyle === 'aws') {
    return Boolean(env.defaultProviderKeys[definition.id] || (env.aws.accessKeyId && env.aws.secretAccessKey));
  }
  return Boolean(env.defaultProviderKeys[definition.id]);
}

function toPublic(profile: SavedProviderProfile): PublicProfile {
  const { apiKey, aws, ...rest } = profile;
  return {
    ...rest,
    hasApiKey: Boolean(apiKey || aws?.secretAccessKey),
    ...(aws
      ? {
          aws: {
            accessKeyId: aws.accessKeyId,
            hasSecretAccessKey: Boolean(aws.secretAccessKey),
            hasSessionToken: Boolean(aws.sessionToken),
          },
        }
      : {}),
  };
}

/**
 * ProviderService is the single source of truth for:
 *   1. Which direct providers exist (the read-only registry, annotated with
 *      whether the server already holds credentials for each).
 *   2. Which provider *profiles* a user has saved locally (CRUD, with every
 *      secret — API key, AWS secret key, AWS session token — encrypted at rest).
 */
export const ProviderService = {
  listDefinitions(): ProviderDefinition[] {
    return PROVIDER_REGISTRY.map((definition) => ({
      ...definition,
      hasServerCredentials: hasServerCredentials(definition),
      hasServerBaseUrl: Boolean(env.defaultProviderBaseUrls[definition.id]),
      defaultRegion: definition.regions ? env.aws.region || definition.defaultRegion : definition.defaultRegion,
    }));
  },

  getDefinition(providerId: string): ProviderDefinition | undefined {
    return getProviderDefinition(providerId);
  },

  listSavedProfiles(): PublicProfile[] {
    return jsonStore.read().providers.map(toPublic);
  },

  toPublic,

  getSavedProfileWithSecret(id: string): SavedProviderProfile | undefined {
    const profile = jsonStore.read().providers.find((entry) => entry.id === id);
    if (!profile) return undefined;
    return {
      ...profile,
      apiKey: profile.apiKey ? decryptSecret(profile.apiKey) : '',
      aws: profile.aws
        ? {
            accessKeyId: profile.aws.accessKeyId,
            secretAccessKey: profile.aws.secretAccessKey ? decryptSecret(profile.aws.secretAccessKey) : '',
            sessionToken: profile.aws.sessionToken ? decryptSecret(profile.aws.sessionToken) : '',
          }
        : undefined,
    };
  },

  saveProfile(input: { name: string } & ProviderConnectionConfig): SavedProviderProfile {
    if (!getProviderDefinition(input.providerId)) {
      throw Object.assign(new Error(`Unknown provider "${input.providerId}".`), { status: 400 });
    }

    return jsonStore.update((store) => {
      const now = Date.now();
      const existing = input.id ? store.providers.find((entry) => entry.id === input.id) : undefined;

      const encryptedKey = input.apiKey ? encryptSecret(input.apiKey) : existing?.apiKey ?? '';
      const aws =
        input.aws || existing?.aws
          ? {
              accessKeyId: input.aws?.accessKeyId ?? existing?.aws?.accessKeyId ?? '',
              secretAccessKey: input.aws?.secretAccessKey
                ? encryptSecret(input.aws.secretAccessKey)
                : existing?.aws?.secretAccessKey ?? '',
              sessionToken: input.aws?.sessionToken
                ? encryptSecret(input.aws.sessionToken)
                : existing?.aws?.sessionToken ?? '',
            }
          : undefined;

      const record: SavedProviderProfile = {
        id: existing?.id ?? uuid(),
        name: input.name,
        providerId: input.providerId,
        label: input.label,
        model: input.model,
        baseUrlOverride: input.baseUrlOverride,
        apiVersion: input.apiVersion,
        region: input.region,
        awsAuthMode: input.awsAuthMode,
        headers: input.headers ?? [],
        apiKey: encryptedKey,
        aws,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      if (existing) {
        store.providers[store.providers.indexOf(existing)] = record;
      } else {
        store.providers.push(record);
      }
      return record;
    });
  },

  deleteProfile(id: string): boolean {
    return jsonStore.update((store) => {
      const before = store.providers.length;
      store.providers = store.providers.filter((entry) => entry.id !== id);
      return store.providers.length < before;
    });
  },
};
