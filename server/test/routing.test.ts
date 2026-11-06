import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getProviderDefinition } from '../src/config/providers.config';
import { resolveProviderUrl, resolveRegion, EndpointError } from '../src/utils/endpoint';
import { verdictFromError, verdictFromFinish } from '../src/utils/guardrail';

const bedrock = getProviderDefinition('aws-bedrock')!;
const azure = getProviderDefinition('azure-openai')!;
const openai = getProviderDefinition('openai')!;

test('Bedrock: region and URL-encoded model in the path; stream path differs', () => {
  const config = { providerId: 'aws-bedrock', model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0' };
  assert.equal(
    resolveProviderUrl(bedrock, config, { stream: true, region: 'ap-south-1' }),
    'https://bedrock-runtime.ap-south-1.amazonaws.com/model/us.anthropic.claude-haiku-4-5-20251001-v1%3A0/converse-stream',
  );
  assert.equal(
    resolveProviderUrl(bedrock, config, { stream: false, region: 'us-east-1' }),
    'https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-haiku-4-5-20251001-v1%3A0/converse',
  );
});

test('Bedrock: inference-profile ARN is fully encoded as one path segment', () => {
  const arn = 'arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123';
  const url = resolveProviderUrl(bedrock, { providerId: 'aws-bedrock', model: arn }, { stream: false, region: 'us-east-1' });
  assert.ok(url.includes('/model/arn%3Aaws%3Abedrock%3Aus-east-1%3A123456789012%3Aapplication-inference-profile%2Fabc123/converse'));
});

test('Bedrock: VPC endpoint override is honoured', () => {
  const url = resolveProviderUrl(
    bedrock,
    { providerId: 'aws-bedrock', model: 'm', baseUrlOverride: 'https://vpce-0abc.bedrock-runtime.us-east-1.vpce.amazonaws.com/' },
    { stream: true, region: 'us-east-1' },
  );
  assert.equal(url, 'https://vpce-0abc.bedrock-runtime.us-east-1.vpce.amazonaws.com/model/m/converse-stream');
});

test('Region validation blocks host injection', () => {
  assert.equal(resolveRegion(bedrock, 'EU-WEST-2', ''), 'eu-west-2');
  assert.equal(resolveRegion(bedrock, '', 'ap-south-1'), 'ap-south-1');
  for (const bad of ['evil.com/', 'us-east-1.attacker.net#', 'us-east-1@x', '../x']) {
    assert.throws(() => resolveRegion(bedrock, bad, ''), EndpointError, bad);
  }
});

test('Azure: resource endpoint → v1 API with no api-version', () => {
  for (const base of [
    'https://acme.openai.azure.com',
    'https://acme.openai.azure.com/',
    'https://acme.openai.azure.com/openai',
    'https://acme.openai.azure.com/openai/v1/',
    'https://acme.openai.azure.com/openai/v1/chat/completions',
  ]) {
    assert.equal(
      resolveProviderUrl(azure, { providerId: 'azure-openai', model: 'gpt-6-sol', baseUrlOverride: base, apiVersion: '2024-10-21' }, { stream: true }),
      'https://acme.openai.azure.com/openai/v1/chat/completions',
      base,
    );
  }
});

test('Azure: legacy deployment URL keeps api-version', () => {
  assert.equal(
    resolveProviderUrl(azure, { providerId: 'azure-openai', model: 'x', baseUrlOverride: 'https://acme.openai.azure.com/openai/deployments/gpt4o' }, { stream: true }),
    'https://acme.openai.azure.com/openai/deployments/gpt4o/chat/completions?api-version=2024-10-21',
  );
  assert.equal(
    resolveProviderUrl(
      azure,
      { providerId: 'azure-openai', model: 'x', baseUrlOverride: 'https://acme.openai.azure.com/openai/deployments/gpt4o/chat/completions', apiVersion: '2025-04-01-preview' },
      { stream: true },
    ),
    'https://acme.openai.azure.com/openai/deployments/gpt4o/chat/completions?api-version=2025-04-01-preview',
  );
});

test('Azure: server-side AZURE_OPENAI_ENDPOINT is used when the browser sends none', () => {
  assert.equal(
    resolveProviderUrl(azure, { providerId: 'azure-openai', model: 'x' }, { stream: true, serverBaseUrl: 'https://corp.openai.azure.com' }),
    'https://corp.openai.azure.com/openai/v1/chat/completions',
  );
});

test('OpenAI: default endpoint unchanged', () => {
  assert.equal(resolveProviderUrl(openai, { providerId: 'openai', model: 'gpt-6-sol' }, { stream: true }), 'https://api.openai.com/v1/chat/completions');
});

test('Verdicts: safety stops and policy errors are blocked; plumbing errors are not', () => {
  assert.equal(verdictFromFinish('stop'), 'allowed');
  assert.equal(verdictFromFinish('content_filter'), 'blocked');
  assert.equal(verdictFromFinish('guardrail_intervened'), 'blocked');
  assert.equal(verdictFromFinish('refusal'), 'blocked');

  assert.equal(verdictFromError('Request blocked by QuilrAI policy: PII detected', 403), 'blocked');
  assert.equal(verdictFromError("The response was filtered due to the prompt triggering Azure OpenAI's content management policy.", 400), 'blocked');
  assert.equal(verdictFromError('Unavailable for legal reasons', 451), 'blocked');

  assert.equal(verdictFromError('Incorrect API key provided: sk-…', 401), 'failed');
  assert.equal(verdictFromError('AccessDeniedException: User is not authorized to perform: bedrock:InvokeModel', 403), 'failed');
  assert.equal(verdictFromError('ValidationException: The provided model identifier is invalid.', 400), 'failed');
  assert.equal(verdictFromError('Unable to reach the upstream service: ECONNREFUSED'), 'failed');
});

test('Gateway API format inference', async () => {
  const { resolveGatewayApiStyle } = await import('../src/services/ChatService');
  assert.equal(resolveGatewayApiStyle(undefined, '/v1/messages'), 'anthropic');
  assert.equal(resolveGatewayApiStyle(undefined, '/anthropic/v1/messages/'), 'anthropic');
  assert.equal(resolveGatewayApiStyle(undefined, '/v1/messages?beta=true'), 'anthropic');
  assert.equal(resolveGatewayApiStyle(undefined, '/chat/completions'), 'openai');
  assert.equal(resolveGatewayApiStyle(undefined, '/v1/messages-archive/search'), 'openai');
  assert.equal(resolveGatewayApiStyle('openai', '/v1/messages'), 'openai');
});
