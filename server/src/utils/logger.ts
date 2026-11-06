import { env } from '../config/env';

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.log(`[QuilrBot ${timestamp()}] INFO  ${message}`, meta ?? '');
  },
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(`[QuilrBot ${timestamp()}] WARN  ${message}`, meta ?? '');
  },
  error(message: string, meta?: Record<string, unknown>) {
    console.error(`[QuilrBot ${timestamp()}] ERROR ${message}`, meta ?? '');
  },
  debug(message: string, meta?: Record<string, unknown>) {
    if (!env.debugMode) return;
    console.log(`[QuilrBot ${timestamp()}] DEBUG ${message}`, meta ?? '');
  },
};
