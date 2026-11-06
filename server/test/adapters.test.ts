import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventStreamDecoder, encodeEventStreamMessage, crc32 } from '../src/adapters/awsEventStream';
import { bedrockConverseAdapter } from '../src/adapters/bedrockConverseAdapter';
import { openaiAdapter } from '../src/adapters/openaiAdapter';
import { anthropicAdapter } from '../src/adapters/anthropicAdapter';
import { toAlternatingTurns } from '../src/adapters/turns';
import type { AdapterEvent } from '../src/types';

const enc = new TextEncoder();

function bedrockEvent(eventType: string, payload: object) {
  return encodeEventStreamMessage(
    { ':event-type': eventType, ':content-type': 'application/json', ':message-type': 'event' },
    JSON.stringify(payload),
  );
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function feedInPieces(decoder: { push(c: Uint8Array): AdapterEvent[]; flush(): AdapterEvent[] }, bytes: Uint8Array, size: number) {
  const events: AdapterEvent[] = [];
  for (let i = 0; i < bytes.length; i += size) events.push(...decoder.push(bytes.subarray(i, i + size)));
  events.push(...decoder.flush());
  return events;
}

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(enc.encode('123456789')), 0xcbf43926);
});

test('event-stream decoder survives frames split at every byte boundary', () => {
  const frame = encodeEventStreamMessage({ ':event-type': 'x', ':message-type': 'event' }, '{"a":1}');
  for (let size = 1; size <= frame.length; size += 1) {
    const decoder = new EventStreamDecoder();
    const messages = [];
    for (let i = 0; i < frame.length; i += size) messages.push(...decoder.push(frame.subarray(i, i + size)));
    assert.equal(messages.length, 1, `chunk size ${size}`);
    assert.equal(messages[0].headers[':event-type'], 'x');
    assert.equal(new TextDecoder().decode(messages[0].payload), '{"a":1}');
  }
});

test('event-stream decoder rejects a corrupted frame', () => {
  const frame = encodeEventStreamMessage({ ':message-type': 'event' }, '{}');
  frame[frame.length - 6] ^= 0xff;
  assert.throws(() => new EventStreamDecoder().push(frame), /CRC/);
});

test('Bedrock ConverseStream: text, stop reason, usage — with 7-byte chunks', () => {
  const stream = concat([
    bedrockEvent('messageStart', { role: 'assistant', p: 'abc' }),
    bedrockEvent('contentBlockDelta', { contentBlockIndex: 0, delta: { text: 'Namaste, ' } }),
    bedrockEvent('contentBlockDelta', { contentBlockIndex: 0, delta: { text: 'नमस्ते 🌏' } }),
    bedrockEvent('contentBlockStop', { contentBlockIndex: 0 }),
    bedrockEvent('messageStop', { stopReason: 'end_turn' }),
    bedrockEvent('metadata', { usage: { inputTokens: 12, outputTokens: 7, totalTokens: 19 }, metrics: { latencyMs: 300 } }),
  ]);
  const events = feedInPieces(bedrockConverseAdapter.createStreamDecoder(), stream, 7);
  const text = events.filter((e) => e.type === 'delta').map((e) => (e as { content: string }).content).join('');
  assert.equal(text, 'Namaste, नमस्ते 🌏');
  assert.deepEqual(events.find((e) => e.type === 'finish'), { type: 'finish', reason: 'end_turn' });
  assert.deepEqual(events.find((e) => e.type === 'usage'), {
    type: 'usage',
    usage: { promptTokens: 12, completionTokens: 7, totalTokens: 19 },
  });
});

test('Bedrock ConverseStream: exception frames become errors', () => {
  const frame = encodeEventStreamMessage(
    { ':exception-type': 'throttlingException', ':message-type': 'exception', ':content-type': 'application/json' },
    JSON.stringify({ message: 'Too many requests' }),
  );
  const events = bedrockConverseAdapter.createStreamDecoder().push(frame);
  assert.deepEqual(events, [{ type: 'error', message: 'throttlingException: Too many requests' }]);
});

test('Bedrock ConverseStream: guardrail stop reason surfaces', () => {
  const events = bedrockConverseAdapter.createStreamDecoder().push(bedrockEvent('messageStop', { stopReason: 'guardrail_intervened' }));
  assert.deepEqual(events, [{ type: 'finish', reason: 'guardrail_intervened' }]);
});

test('Bedrock Converse body: alternating turns, system block, inferenceConfig', () => {
  const body = bedrockConverseAdapter.buildBody({
    model: 'm',
    stream: true,
    maxTokens: 512,
    systemPrompt: '  Be brief.  ',
    messages: [
      { role: 'assistant', content: 'stale greeting' },
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'c' },
    ],
  });
  assert.deepEqual(body, {
    messages: [
      { role: 'user', content: [{ text: 'a\n\nb' }] },
      { role: 'assistant', content: [{ text: 'c' }] },
    ],
    system: [{ text: 'Be brief.' }],
    inferenceConfig: { maxTokens: 512 },
  });
});

test('Bedrock non-stream response and error payload', () => {
  const events = bedrockConverseAdapter.parseNonStreamResponse({
    output: { message: { role: 'assistant', content: [{ text: 'Hi' }] } },
    stopReason: 'end_turn',
    usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4 },
  });
  assert.deepEqual(events[0], { type: 'delta', content: 'Hi' });
  const headers = new Headers({ 'x-amzn-errortype': 'ValidationException:http://internal.amazon.com/coral/com.amazon.bedrock/' });
  assert.equal(
    bedrockConverseAdapter.parseErrorPayload({ message: 'The provided model identifier is invalid.' }, 400, headers),
    'ValidationException: The provided model identifier is invalid.',
  );
});

test('OpenAI SSE: multibyte text split mid-character, usage in final chunk', () => {
  const sse =
    'data: {"model":"gpt-6-sol","choices":[{"delta":{"content":"नमस्"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":"ते"},"finish_reason":"stop"}]}\n\n' +
    'data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n\n' +
    'data: [DONE]\n\n';
  const events = feedInPieces(openaiAdapter.createStreamDecoder(), enc.encode(sse), 5);
  const text = events.filter((e) => e.type === 'delta').map((e) => (e as { content: string }).content).join('');
  assert.equal(text, 'नमस्ते');
  assert.ok(events.some((e) => e.type === 'usage' && e.usage.totalTokens === 7));
  assert.ok(events.some((e) => e.type === 'finish' && e.reason === 'stop'));
});

test('OpenAI body requests streamed usage only when configured', () => {
  const base = { model: 'm', messages: [{ role: 'user' as const, content: 'x' }], stream: true };
  assert.deepEqual(openaiAdapter.buildBody({ ...base, includeStreamUsage: true }).stream_options, { include_usage: true });
  assert.equal(openaiAdapter.buildBody(base).stream_options, undefined);
  assert.equal(openaiAdapter.buildBody({ ...base, maxTokens: 99, maxTokensField: 'max_completion_tokens' }).max_completion_tokens, 99);
  assert.equal(openaiAdapter.buildBody({ ...base, maxTokens: 99 }).max_tokens, undefined);
});

test('Anthropic SSE: input tokens from message_start, output from message_delta', () => {
  const sse = [
    'event: message_start',
    'data: {"type":"message_start","message":{"model":"claude-sonnet-5-5","usage":{"input_tokens":20,"cache_read_input_tokens":5,"output_tokens":1}}}',
    '',
    'event: content_block_delta',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"hmm"}}',
    '',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
    '',
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":9}}',
    '',
  ].join('\n');
  const events = feedInPieces(anthropicAdapter.createStreamDecoder(), enc.encode(sse), 11);
  assert.deepEqual(events.filter((e) => e.type === 'delta'), [{ type: 'delta', content: 'Hello' }]);
  assert.deepEqual(
    events.filter((e) => e.type === 'usage'),
    [
      { type: 'usage', usage: { promptTokens: 25 } },
      { type: 'usage', usage: { completionTokens: 9 } },
    ],
  );
});

test('toAlternatingTurns drops leading assistant and merges repeats', () => {
  assert.deepEqual(
    toAlternatingTurns([
      { role: 'system', content: 's' },
      { role: 'assistant', content: 'x' },
      { role: 'user', content: 'q' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'r' },
    ]),
    [{ role: 'user', content: 'q\n\nr' }],
  );
});

test('Anthropic always sends a valid positive max_tokens', async () => {
  const { validMaxTokens } = await import('../src/adapters/anthropicAdapter');
  const base = { model: 'm', messages: [{ role: 'user' as const, content: 'x' }], stream: false };
  for (const [input, expected] of [[undefined, 4096], [0, 4096], [-5, 4096], [Number.NaN, 4096], [1024, 1024], [512.7, 512]] as const) {
    assert.equal(anthropicAdapter.buildBody({ ...base, maxTokens: input as number | undefined }).max_tokens, expected, String(input));
  }
  assert.equal(validMaxTokens(null as unknown as number), 4096);
});

test('OpenRouter is configured to send max_tokens (Claude models require it)', async () => {
  const { getProviderDefinition } = await import('../src/config/providers.config');
  assert.equal(getProviderDefinition('openrouter')?.maxTokensField, 'max_tokens');
});
