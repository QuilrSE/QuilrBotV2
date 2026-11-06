# Provider endpoints and message formats

Checked against each provider's documentation in **November 2026**. Model lists in
`server/src/config/providers.config.ts` are *suggestions* shown in the UI, not an
allow-list: any model id the provider accepts can be typed into the connection form.

QuilrBot speaks three wire dialects. Each lives in one adapter under
`server/src/adapters/`, and every provider is configuration that points at one of them.

| Dialect | Adapter | Request | Streaming framing |
|---|---|---|---|
| OpenAI Chat Completions | `openaiAdapter.ts` | `POST {base}/chat/completions` | Server-Sent Events, `data: [DONE]` |
| Anthropic Messages | `anthropicAdapter.ts` | `POST {base}/messages` | Server-Sent Events, typed events |
| Bedrock Converse | `bedrockConverseAdapter.ts` | `POST /model/{modelId}/converse[-stream]` | Binary AWS event stream |

## Provider by provider

| Provider | Endpoint | Auth | Notes |
|---|---|---|---|
| OpenAI | `https://api.openai.com/v1/chat/completions` | Bearer | Sends `stream_options.include_usage` so streamed replies report tokens. Caps output with `max_completion_tokens` (GPT-5+ and reasoning models reject `max_tokens`). |
| Azure OpenAI | Resource endpoint → `{resource}/openai/v1/chat/completions` | `api-key` header | **v1 API** (GA since Aug 2025): no `api-version`; `model` is the deployment name. A full `…/openai/deployments/<name>` URL still works and uses the legacy dated API (`api-version` defaults to `2024-10-21`). |
| Anthropic | `https://api.anthropic.com/v1/messages` | `x-api-key` + `anthropic-version: 2023-06-01` | `max_tokens` is required. Input tokens come from `message_start`, output tokens from `message_delta`. Turns are normalized to start with `user` and alternate. |
| **AWS Bedrock** | `https://bedrock-runtime.{region}.amazonaws.com/model/{modelId}/converse` and `/converse-stream` | Bedrock API key (Bearer) **or** IAM keys (SigV4, service `bedrock`) | See below. |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` | Bearer | OpenAI-compatible endpoint. |
| Mistral | `https://api.mistral.ai/v1/chat/completions` | Bearer | `-latest` aliases. |
| Cohere | `https://api.cohere.ai/compatibility/v1/chat/completions` | Bearer | Compatibility API. `stream_options` not sent. |
| Groq | `https://api.groq.com/openai/v1/chat/completions` | Bearer | GPT-OSS models use the `openai/` prefix. |
| DeepSeek | `https://api.deepseek.com/chat/completions` | Bearer | `deepseek-chat` / `deepseek-reasoner` were deprecated on 2026-07-24; use `deepseek-flash` / `deepseek-v4-pro`. |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | Bearer | Sends `max_tokens`, since Claude models behind OpenRouter require it. |
| LLM Gateway | `{baseUrl}{endpointPath}` | Bearer, custom header, or none | **API format is set per gateway**: *OpenAI Chat Completions* (default path `/chat/completions`) or *Anthropic Messages* (default path `/v1/messages`). Anthropic format uses the Anthropic adapter: top-level `system`, required `max_tokens`, alternating turns, and an `anthropic-version: 2023-06-01` header (a custom header overrides it). If no format is set, a path ending in `/messages` is treated as Anthropic. OpenAI format sends the output cap as `max_tokens` by default; gateways fronting Claude (e.g. LiteLLM → Anthropic or Bedrock) reject requests without it. Configurable per gateway: `max_tokens`, `max_completion_tokens`, or none. `stream_options` is not sent, since not every gateway accepts it. |

## AWS Bedrock in detail

**Why Converse.** One request shape for every Bedrock text model (Anthropic, Amazon Nova,
Meta, Mistral, Cohere), so model ids and inference-profile ARNs can be swapped freely.

**Request body**

```json
{
  "messages": [{ "role": "user", "content": [{ "text": "Hello" }] }],
  "system": [{ "text": "You are a concise assistant." }],
  "inferenceConfig": { "maxTokens": 4096 }
}
```

**Streaming.** `/converse-stream` returns `application/vnd.amazon.eventstream`: binary
frames (lengths, CRC-32 checksums, typed headers, JSON payload). The decoder in
`awsEventStream.ts` buffers across network chunks and verifies both checksums. Events used:
`contentBlockDelta` (text), `messageStop` (`stopReason`), `metadata` (`usage`). Frames with
`:message-type: exception` become errors (e.g. `throttlingException: Too many requests`).

**Model ids.** Most current Claude models must be called through an inference profile,
not the bare model id: a geo prefix (`us.`, `eu.`, `in.`, `jp.`, `au.`) or `global.`,
for example `us.anthropic.claude-sonnet-5` or `global.anthropic.claude-opus-5-5`. For
workloads that must stay in India, `in.anthropic.claude-sonnet-5` with region
`ap-south-1`. Application inference-profile ARNs work too; the id is URL-encoded as a
single path segment.

**Authentication**

- *Bedrock API key*: `Authorization: Bearer <key>`. Generated in the Bedrock console
  under **API keys**. Server fallback: `AWS_BEARER_TOKEN_BEDROCK`.
- *IAM access keys*: the relay signs the exact request bytes with SigV4
  (`server/src/services/aws/sigv4.ts`, no SDK dependency). Path segments are
  double-encoded as AWS requires for non-S3 services (`:` → `%3A` → `%253A`).
  Session tokens are sent as `x-amz-security-token`. Server fallback:
  `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN`.
- Required IAM actions: `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream`.

**Endpoint override.** Accepts a VPC interface endpoint (PrivateLink) URL. The signing
region still comes from the region field.

**Region safety.** The region is interpolated into a hostname, so it is validated against
`^[a-z]{2}(-[a-z]+)+-\d{1,2}$` before any request is built.

## Guardrail verdicts

Every reply is labelled (`server/src/utils/guardrail.ts`):

- **Blocked**: a safety stop reason (`content_filter`, `refusal`, `guardrail_intervened`,
  `content_filtered`), HTTP 451, or an error with a policy-like status
  (400/403/406/409/422) whose text reads like a policy decision.
- **Failed**: anything else, including credential, signature, unknown-model, quota and
  network errors. These are checked first, so a misconfiguration is never reported as a
  working guardrail.
- **Allowed**: the model answered normally.

Gateway error bodies that are HTML block pages are stripped to readable text.

## Sources

- AWS: ConverseStream API reference; Bedrock API keys; Claude Sonnet 5 and Opus 5.5 model cards
- Microsoft Learn: Azure OpenAI API version lifecycle (v1 API)
- OpenAI: models and deprecations pages
- Google AI: Gemini OpenAI compatibility and models pages
- Cohere: Compatibility API
- Groq: supported models
- DeepSeek: API docs, first API call
