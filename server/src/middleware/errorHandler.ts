import type { ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = (err as { status?: number }).status ?? 500;
  const message = err instanceof Error ? err.message : 'Unexpected server error.';

  logger.error(message, { status });

  if (res.headersSent) {
    res.end();
    return;
  }

  res.status(status).json({ error: { message } });
};
