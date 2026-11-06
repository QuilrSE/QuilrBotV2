import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';
import { providersRouter } from './routes/providers';
import { gatewaysRouter } from './routes/gateways';
import { settingsRouter } from './routes/settings';
import { chatRouter } from './routes/chat';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.allowedOrigin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    }),
  );
  app.use(express.json({ limit: '2mb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/providers', providersRouter);
  app.use('/api/gateways', gatewaysRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/chat', chatRouter);

  app.use(errorHandler);
  return app;
}
