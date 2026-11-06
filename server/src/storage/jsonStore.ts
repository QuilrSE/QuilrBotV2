import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { StoreShape } from '../types';

const STORE_PATH = path.resolve(__dirname, '../../', env.storePath);

const DEFAULT_STORE: StoreShape = {
  providers: [],
  gateways: [],
  settings: {
    general: { theme: 'dark', language: 'en' },
    advanced: {
      requestTimeoutMs: env.defaultTimeoutMs,
      streamingEnabled: env.defaultStreaming,
      debugMode: env.debugMode,
      maxTokens: env.defaultMaxTokens,
    },
    defaultGatewayId: undefined,
  },
};

function ensureStoreFile(): void {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2));
  }
}

function readStore(): StoreShape {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw || '{}');
    return {
      providers: parsed.providers ?? [],
      gateways: parsed.gateways ?? [],
      settings: {
        general: { ...DEFAULT_STORE.settings.general, ...(parsed.settings?.general ?? {}) },
        advanced: { ...DEFAULT_STORE.settings.advanced, ...(parsed.settings?.advanced ?? {}) },
        defaultGatewayId: parsed.settings?.defaultGatewayId,
      },
    };
  } catch (error) {
    logger.error('Failed to read local store, falling back to defaults.', { error: String(error) });
    return DEFAULT_STORE;
  }
}

function writeStore(store: StoreShape): void {
  ensureStoreFile();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

/**
 * A minimal file-based JSON persistence layer. QuilrBot runs as a local,
 * single-tenant desktop-style app, so a lock-free read/modify/write over a
 * single JSON file is sufficient — see docs/STORAGE_DESIGN.md for the
 * rationale and the upgrade path to a real database.
 */
export const jsonStore = {
  read: readStore,
  write: writeStore,
  update<T>(mutator: (store: StoreShape) => T): T {
    const store = readStore();
    const result = mutator(store);
    writeStore(store);
    return result;
  },
};
