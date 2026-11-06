import './setup-env';
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { createApp } from '../src/app';
import { encodeEventStreamMessage } from '../src/adapters/awsEventStream';
import { signRequest } from '../src/services/aws/sigv4';

const CREDS = { accessKeyId: 'AKIDTEST', secretAccessKey: 'secret/KEY+1', sessionToken: 'sess-token' };

let relay: http.Server;
let upstream: http.Server;
let relayUrl = '';
let upstreamUrl = '';
const seen: Array<{ url: string; headers: http.IncomingHttpHeaders; body: string }> = [];

function frame(type: string, payload: object) {
  return encodeEventStreamMessage({ ':event-type': type, ':message-type': 'event', ':content-type': 'application/json' }, JSON.stringify(payload));
}

before(async () => {
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push({ url: req.url!, headers: req.headers, body });

      if (req.url!.startsWith('/model/')) {
        // Independently re-derive the SigV4 signature from what actually arrived on the wire.
        if (req.headers.authorization?.startsWith('AWS4-HMAC-SHA256')) {
          const amz = String(req.headers['x-amz-date']);
          const now = new Date(`${amz.slice(0, 4)}-${amz.slice(4, 6)}-${amz.slice(6, 8)}T${amz.slice(9, 11)}:${amz.slice(11, 13)}:${amz.slice(13, 15)}Z`);
          const signedNames = /SignedHeaders=([^,]+)/.exec(req.headers.authorization)![1].split(';');
          const headers: Record<string, string> = {};
          for (const name of signedNames) headers[name] = String(req.headers[name]);
          const expected = signRequest(
            { method: 'POST', url: `http://${req.headers.host}${req.url}`, headers, body },
            { service: 'bedrock', region: 'ap-south-1', credentials: CREDS, now },
          );
          if (expected.authorization !== req.headers.authorization) {
            res.writeHead(403, { 'Content-Type': 'application/json', 'x-amzn-errortype': 'InvalidSignatureException:x' });
            res.end(JSON.stringify({ message: 'The request signature we calculated does not match the signature you provided.' }));
            return;
          }
        } else if (req.headers.authorization !== 'Bearer bedrock-api-key') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Invalid bearer token' }));
          return;
        }

        if (req.url!.endsWith('/converse-stream')) {
          res.writeHead(200, { 'Content-Type': 'application/vnd.amazon.eventstream' });
          const bytes = Buffer.concat([
            frame('messageStart', { role: 'assistant' }),
            frame('contentBlockDelta', { contentBlockIndex: 0, delta: { text: 'Hello from ' } }),
            frame('contentBlockDelta', { contentBlockIndex: 0, delta: { text: 'Bedrock' } }),
            frame('messageStop', { stopReason: 'end_turn' }),
            frame('metadata', { usage: { inputTokens: 11, outputTokens: 3, totalTokens: 14 } }),
          ]);
          // Dribble it out in awkward pieces.
          let i = 0;
          const tick = () => {
            if (i >= bytes.length) return res.end();
            res.write(bytes.subarray(i, i + 13));
            i += 13;
            setImmediate(tick);
          };
          tick();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ output: { message: { content: [{ text: 'non-stream ok' }] } }, stopReason: 'guardrail_intervened', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }));
        return;
      }

      if (req.url === '/anthropic-gw/v1/messages') {
        // Enforces the Anthropic Messages API's rules, with its real error text.
        const parsed = JSON.parse(body);
        const fail = (message: string) => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message } }));
        };
        if (parsed.messages?.[0]?.role === 'system') {
          return fail("messages.0: use the top-level 'system' parameter for the initial system prompt; the directive-only form (content: [] with output_config) is accepted at any position");
        }
        if (!parsed.max_tokens) return fail('max_tokens: Field required');
        if (!req.headers['anthropic-version']) return fail('anthropic-version: header is required');
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end(
          [
            'event: message_start',
            'data: {"type":"message_start","message":{"model":"claude-sonnet-5-5","usage":{"input_tokens":17,"output_tokens":1}}}',
            '',
            'event: content_block_delta',
            'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello via gateway"}}',
            '',
            'event: message_delta',
            'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":4}}',
            '',
            'event: message_stop',
            'data: {"type":"message_stop"}',
            '',
            '',
          ].join('\n'),
        );
        return;
      }

      if (req.url === '/claude-gw/chat/completions') {
        // Behaves like a gateway fronting Claude: an output cap is mandatory.
        const parsed = JSON.parse(body);
        if (parsed.max_tokens === undefined) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: "Missing required parameter: 'max_tokens'", type: 'invalid_request_error' } }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end(
          'data: {"model":"claude-sonnet-5-5","choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n' +
            'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":1,"total_tokens":4}}\n\ndata: [DONE]\n\n',
        );
        return;
      }

      if (req.url === '/gw/chat/completions') {
        // A gateway that blocks with an HTML page, the way many policy engines do.
        res.writeHead(403, { 'Content-Type': 'text/html' });
        res.end('<html><head><style>body{}</style></head><body><h1>Blocked</h1><p>Request blocked by QuilrAI policy: credit card number detected.</p></body></html>');
        return;
      }
      res.writeHead(404).end();
    });
  });
  await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', r));
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;

  relay = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => relay.once('listening', r));
  relayUrl = `http://127.0.0.1:${(relay.address() as AddressInfo).port}`;
});

after(() => {
  relay.close();
  upstream.close();
});

async function chat(body: object) {
  const res = await fetch(`${relayUrl}/api/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  const events = text
    .split('\n\n')
    .map((f) => f.split('\n').find((l) => l.startsWith('data:')))
    .filter(Boolean)
    .map((l) => JSON.parse(l!.slice(5)));
  return { status: res.status, events };
}

const bedrockBase = (auth: object) => ({
  mode: 'provider',
  model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  provider: { providerId: 'aws-bedrock', model: 'x', region: 'ap-south-1', ...auth, headers: [{ name: 'x-trace', value: 't1', enabled: true }] },
  messages: [{ role: 'user', content: 'hi' }],
  systemPrompt: 'Be brief.',
  stream: true,
});

test('Bedrock via IAM (SigV4) streams end-to-end and the signature verifies upstream', async () => {
  const body = bedrockBase({ awsAuthMode: 'iam', aws: CREDS });
  (body.provider as Record<string, unknown>).baseUrlOverride = upstreamUrl;
  const { status, events } = await chat(body);
  assert.equal(status, 200);
  assert.equal(events.filter((e) => e.type === 'delta').map((e) => e.content).join(''), 'Hello from Bedrock');
  const done = events.find((e) => e.type === 'done');
  assert.ok(done, JSON.stringify(events));
  assert.deepEqual(done.usage, { promptTokens: 11, completionTokens: 3, totalTokens: 14 });
  assert.equal(done.verdict, 'allowed');
  assert.equal(done.finishReason, 'end_turn');

  const req = seen.at(-1)!;
  assert.equal(req.url, '/model/us.anthropic.claude-haiku-4-5-20251001-v1%3A0/converse-stream');
  assert.equal(req.headers['x-amz-security-token'], 'sess-token');
  assert.equal(req.headers['x-trace'], 't1');
  assert.deepEqual(JSON.parse(req.body).system, [{ text: 'Be brief.' }]);
});

test('Bedrock via API key (bearer), non-streaming, guardrail stop → blocked', async () => {
  const body = { ...bedrockBase({ awsAuthMode: 'api-key', apiKey: 'bedrock-api-key' }), stream: false };
  (body.provider as Record<string, unknown>).baseUrlOverride = upstreamUrl;
  const { events } = await chat(body);
  const done = events.find((e) => e.type === 'done');
  assert.equal(done.verdict, 'blocked');
  assert.equal(seen.at(-1)!.url.endsWith('/converse'), true);
});

test('Bedrock with a wrong secret: upstream rejects the signature → failed, not blocked', async () => {
  const body = bedrockBase({ awsAuthMode: 'iam', aws: { ...CREDS, secretAccessKey: 'wrong' } });
  (body.provider as Record<string, unknown>).baseUrlOverride = upstreamUrl;
  const { events } = await chat(body);
  const error = events.find((e) => e.type === 'error');
  assert.equal(error.status, 403);
  assert.match(error.message, /^InvalidSignatureException: /);
  assert.equal(error.verdict, 'failed');
});

test('Bedrock with no credentials anywhere is rejected before any network call', async () => {
  const count = seen.length;
  const res = await fetch(`${relayUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bedrockBase({ awsAuthMode: 'iam' })),
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error.message, /access key/i);
  assert.equal(seen.length, count);
});

test('Malicious region is rejected before any network call', async () => {
  const res = await fetch(`${relayUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bedrockBase({ awsAuthMode: 'api-key', apiKey: 'k', region: 'evil.example.com#' })),
  });
  assert.equal(res.status, 400);
});

test('Gateway HTML block page → readable message and blocked verdict', async () => {
  const { events } = await chat({
    mode: 'gateway',
    model: 'gpt-6-sol',
    gateway: { name: 'gw', baseUrl: `${upstreamUrl}/gw`, endpointPath: '/chat/completions', authMethod: 'bearer', apiKey: 'k', headers: [] },
    messages: [{ role: 'user', content: '4929-3813-3266-4295' }],
    stream: true,
  });
  const error = events.find((e) => e.type === 'error');
  assert.equal(error.verdict, 'blocked');
  assert.equal(error.status, 403);
  assert.match(error.message, /Request blocked by QuilrAI policy: credit card number detected\./);
  assert.doesNotMatch(error.message, /<|body\{/);
});

test('Catalog lists AWS Bedrock with regions', async () => {
  const { providers } = await (await fetch(`${relayUrl}/api/providers/catalog`)).json();
  const bedrock = providers.find((p: { id: string }) => p.id === 'aws-bedrock');
  assert.equal(bedrock.apiStyle, 'bedrock-converse');
  assert.ok(bedrock.regions.includes('ap-south-1'));
  assert.equal(typeof bedrock.hasServerCredentials, 'boolean');
});

test('Saved Bedrock profile encrypts AWS secrets and never returns them in lists', async () => {
  const saved = await (
    await fetch(`${relayUrl}/api/providers/saved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bedrock Mumbai', providerId: 'aws-bedrock', model: 'm', region: 'ap-south-1', awsAuthMode: 'iam', aws: CREDS }),
    })
  ).json();
  assert.equal(saved.profile.aws.hasSecretAccessKey, true);
  assert.equal(saved.profile.aws.secretAccessKey, undefined);
  assert.equal(JSON.stringify(saved).includes('secret/KEY+1'), false);

  const fs = await import('node:fs');
  const raw = fs.readFileSync(process.env.QUILRBOT_STORE_PATH!, 'utf-8');
  assert.equal(raw.includes('secret/KEY+1'), false);
  assert.equal(raw.includes('sess-token'), false);

  const revealed = await (await fetch(`${relayUrl}/api/providers/saved/${saved.profile.id}/reveal`)).json();
  assert.equal(revealed.profile.aws.secretAccessKey, 'secret/KEY+1');
  assert.equal(revealed.profile.aws.sessionToken, 'sess-token');
});

const claudeGateway = (extra: object = {}) => ({
  mode: 'gateway',
  model: 'claude-sonnet-5-5',
  gateway: { name: 'litellm', baseUrl: `${upstreamUrl}/claude-gw`, endpointPath: '/chat/completions', authMethod: 'none', headers: [], ...extra },
  messages: [{ role: 'user', content: 'hi' }],
  stream: true,
  maxTokens: 2048,
});

test('Gateway fronting Claude: max_tokens is sent by default, so the request succeeds', async () => {
  const { events } = await chat(claudeGateway());
  assert.equal(events.find((e) => e.type === 'done')?.verdict, 'allowed', JSON.stringify(events));
  assert.equal(JSON.parse(seen.at(-1)!.body).max_tokens, 2048);
});

test('Gateway with max_completion_tokens selected sends that field instead', async () => {
  await chat(claudeGateway({ maxTokensField: 'max_completion_tokens' }));
  const sent = JSON.parse(seen.at(-1)!.body);
  assert.equal(sent.max_completion_tokens, 2048);
  assert.equal(sent.max_tokens, undefined);
});

test('Gateway with "none" sends no cap (reproduces the original error)', async () => {
  const { events } = await chat(claudeGateway({ maxTokensField: 'none' }));
  const error = events.find((e) => e.type === 'error');
  assert.equal(error.message, "Missing required parameter: 'max_tokens'");
  assert.equal(error.verdict, 'failed');
});

const anthropicGateway = (extra: object = {}) => ({
  mode: 'gateway',
  model: 'claude-sonnet-5-5',
  gateway: { name: 'anthropic-gw', baseUrl: `${upstreamUrl}/anthropic-gw`, endpointPath: '/v1/messages', authMethod: 'header', authHeaderName: 'x-api-key', apiKey: 'k', headers: [], ...extra },
  messages: [
    { role: 'assistant', content: 'stale reply from an earlier failure' },
    { role: 'user', content: 'hi' },
  ],
  systemPrompt: 'You are a concise, helpful AI assistant.',
  stream: true,
  maxTokens: 1024,
});

test('Anthropic-format gateway: top-level system, max_tokens, version header, streamed reply', async () => {
  const { events } = await chat(anthropicGateway({ apiStyle: 'anthropic' }));
  const done = events.find((e) => e.type === 'done');
  assert.ok(done, JSON.stringify(events));
  assert.equal(events.filter((e) => e.type === 'delta').map((e) => e.content).join(''), 'Hello via gateway');
  assert.deepEqual(done.usage, { promptTokens: 17, completionTokens: 4, totalTokens: 21 });

  const req = seen.at(-1)!;
  const sent = JSON.parse(req.body);
  assert.equal(sent.system, 'You are a concise, helpful AI assistant.');
  assert.deepEqual(sent.messages, [{ role: 'user', content: 'hi' }]);
  assert.equal(sent.max_tokens, 1024);
  assert.equal(req.headers['anthropic-version'], '2023-06-01');
  assert.equal(req.headers['x-api-key'], 'k');
});

test('Anthropic-format gateway is detected from a /v1/messages path when apiStyle is not set', async () => {
  const { events } = await chat(anthropicGateway());
  assert.ok(events.find((e) => e.type === 'done'), JSON.stringify(events));
});

test('Forcing OpenAI format at a /v1/messages endpoint reproduces the original error', async () => {
  const { events } = await chat(anthropicGateway({ apiStyle: 'openai' }));
  const error = events.find((e) => e.type === 'error');
  assert.match(error.message, /^messages\.0: use the top-level 'system' parameter/);
  assert.equal(error.verdict, 'failed');
});

test('A custom anthropic-version header overrides the default', async () => {
  await chat(anthropicGateway({ apiStyle: 'anthropic', headers: [{ name: 'anthropic-version', value: '2024-01-01', enabled: true }] }));
  assert.equal(seen.at(-1)!.headers['anthropic-version'], '2024-01-01');
});
