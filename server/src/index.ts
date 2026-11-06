import { env } from './config/env';
import { logger } from './utils/logger';
import { createApp } from './app';

createApp().listen(env.serverPort, () => {
  logger.info(`QuilrBot API server listening on http://localhost:${env.serverPort}`);
});
