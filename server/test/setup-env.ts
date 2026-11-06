// Imported first by tests that boot the app, so env is set before config loads.
import os from 'node:os';
import path from 'node:path';

process.env.QUILRBOT_STORE_PATH = path.join(os.tmpdir(), `quilrbot-test-${process.pid}.json`);
process.env.QUILRBOT_ENCRYPTION_KEY = 'a'.repeat(64);
for (const name of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_BEARER_TOKEN_BEDROCK', 'AWS_REGION']) {
  process.env[name] = '';
}
