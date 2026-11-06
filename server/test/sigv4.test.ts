import assert from 'node:assert/strict';
import { test } from 'node:test';
import crypto from 'crypto';
import { signRequest, __internal } from '../src/services/aws/sigv4';

// AWS SigV4 test suite credentials (published in the AWS docs).
const CREDS = { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' };
const NOW = new Date('2015-08-30T12:36:00Z');

/** The suite's vectors don't include x-amz-content-sha256, so recompute without it. */
function signLikeSuite(method: string, url: string) {
  // Re-implement the minimal suite form by signing, then checking our canonical
  // pieces independently via a manual derivation below.
  return signRequest({ method, url, headers: {}, body: '' }, { service: 'service', region: 'us-east-1', credentials: CREDS, now: NOW });
}

test('get-vanilla: derived signature matches AWS test suite', () => {
  // The suite signs only host + x-amz-date. Derive that exact signature by hand
  // using the same primitives, and compare to the published value.
  const canonicalRequest = [
    'GET',
    '/',
    '',
    'host:example.amazonaws.com\nx-amz-date:20150830T123600Z\n',
    'host;x-amz-date',
    crypto.createHash('sha256').update('').digest('hex'),
  ].join('\n');
  const scope = '20150830/us-east-1/service/aws4_request';
  const sts = ['AWS4-HMAC-SHA256', '20150830T123600Z', scope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
  const h = (k: crypto.BinaryLike, d: string) => crypto.createHmac('sha256', k).update(d).digest();
  const key = h(h(h(h(`AWS4${CREDS.secretAccessKey}`, '20150830'), 'us-east-1'), 'service'), 'aws4_request');
  const sig = crypto.createHmac('sha256', key).update(sts).digest('hex');
  assert.equal(sig, '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31');
});

test('get-vanilla: signRequest itself reproduces the AWS test-suite signature', () => {
  const headers = signRequest(
    { method: 'GET', url: 'https://example.amazonaws.com/', headers: {}, body: '' },
    { service: 'service', region: 'us-east-1', credentials: CREDS, now: NOW, signContentSha256Header: false },
  );
  assert.equal(
    headers.authorization,
    'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
  );
});

test('get-vanilla-query-order-key-case: query params are sorted', () => {
  const headers = signRequest(
    { method: 'GET', url: 'https://example.amazonaws.com/?Param2=value2&Param1=value1', headers: {}, body: '' },
    { service: 'service', region: 'us-east-1', credentials: CREDS, now: NOW, signContentSha256Header: false },
  );
  assert.ok(headers.authorization.endsWith('Signature=b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500'), headers.authorization);
});

test('signRequest produces the documented Authorization shape', () => {
  const headers = signLikeSuite('GET', 'https://example.amazonaws.com/');
  assert.match(
    headers.authorization,
    /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20150830\/us-east-1\/service\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
  );
  assert.equal(headers['x-amz-date'], '20150830T123600Z');
  assert.equal(headers.host, 'example.amazonaws.com');
});

test('signRequest agrees with a hand-derived signature for a Bedrock-style POST', () => {
  const body = JSON.stringify({ messages: [{ role: 'user', content: [{ text: 'hi' }] }] });
  const url = `https://bedrock-runtime.us-east-1.amazonaws.com/model/${encodeURIComponent('us.anthropic.claude-haiku-4-5-20251001-v1:0')}/converse`;
  const out = signRequest(
    { method: 'POST', url, headers: { 'Content-Type': 'application/json' }, body },
    { service: 'bedrock', region: 'us-east-1', credentials: { ...CREDS, sessionToken: 'TOKEN' }, now: NOW },
  );

  const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
  const canonicalRequest = [
    'POST',
    // Double-encoded: ':' → '%3A' in the URL → '%253A' canonically.
    '/model/us.anthropic.claude-haiku-4-5-20251001-v1%253A0/converse',
    '',
    `content-type:application/json\nhost:bedrock-runtime.us-east-1.amazonaws.com\nx-amz-content-sha256:${payloadHash}\nx-amz-date:20150830T123600Z\nx-amz-security-token:TOKEN\n`,
    'content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token',
    payloadHash,
  ].join('\n');
  const scope = '20150830/us-east-1/bedrock/aws4_request';
  const sts = ['AWS4-HMAC-SHA256', '20150830T123600Z', scope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
  const h = (k: crypto.BinaryLike, d: string) => crypto.createHmac('sha256', k).update(d).digest();
  const key = h(h(h(h(`AWS4${CREDS.secretAccessKey}`, '20150830'), 'us-east-1'), 'bedrock'), 'aws4_request');
  const expected = crypto.createHmac('sha256', key).update(sts).digest('hex');

  assert.ok(out.authorization.endsWith(`Signature=${expected}`), out.authorization);
  assert.equal(out['x-amz-security-token'], 'TOKEN');
});

test('canonical path double-encodes model ids and inference-profile ARNs', () => {
  const arn = 'arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123';
  const path = new URL(`https://x.amazonaws.com/model/${encodeURIComponent(arn)}/converse`).pathname;
  assert.equal(
    __internal.canonicalPath(path),
    '/model/arn%253Aaws%253Abedrock%253Aus-east-1%253A123456789012%253Aapplication-inference-profile%252Fabc123/converse',
  );
});
