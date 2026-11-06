import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const ALGORITHM = 'aes-256-gcm';
const KEY_FILE = path.resolve(__dirname, '../../data/.encryption-key');

function loadOrCreateKey(): Buffer {
  if (env.encryptionKey && /^[0-9a-fA-F]{64}$/.test(env.encryptionKey)) {
    return Buffer.from(env.encryptionKey, 'hex');
  }

  if (fs.existsSync(KEY_FILE)) {
    return Buffer.from(fs.readFileSync(KEY_FILE, 'utf-8').trim(), 'hex');
  }

  const generated = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(KEY_FILE, generated.toString('hex'), { mode: 0o600 });
  logger.warn('Generated a new local encryption key for stored secrets (data/.encryption-key).');
  return generated;
}

const KEY = loadOrCreateKey();

/** Encrypts a plaintext secret for at-rest storage in the local JSON store. */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  if (!payload) return '';
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') return '';

  try {
    const [, ivHex, authTagHex, dataHex] = parts;
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf-8');
  } catch {
    return '';
  }
}
