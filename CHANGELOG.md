# Changelog

## 2.0.0

### Added
- **AWS Bedrock** via the Converse / ConverseStream API.
  - Two auth methods: Bedrock API keys (bearer) or IAM access keys (SigV4, with optional session token).
  - Region picker, inference profiles and ARNs, and VPC endpoint override.
  - Server-side credentials (`AWS_BEARER_TOKEN_BEDROCK`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`).
  - Dependency-free SigV4 signer, verified against AWS test-suite vectors.
  - AWS event-stream decoder with CRC checks.
- **Guardrail verdicts** (Allowed / Blocked / Failed) on every reply, with per-column tallies in Split View.
- **Server-side credentials for every provider.** Keys set in `server/.env` are used when the browser sends none, and the UI says so.
- **Latency and responding model** shown under every reply.
- **Max output tokens** setting.
- **Server test suite**: 35 tests across SigV4, adapters, routing, and end-to-end runs against mock Bedrock and gateway servers. Run with `npm test`.

### Changed
- **Azure OpenAI** uses the GA v1 API (`/openai/v1/chat/completions`, no `api-version`). Legacy deployment URLs still work.
- **DeepSeek** base URL is now `https://api.deepseek.com`, with models `deepseek-flash` and `deepseek-v4-pro` (the old names were deprecated 2026-07-24).
- **Model suggestions** refreshed for OpenAI, Anthropic, Gemini, Groq, Cohere and OpenRouter.
- **OpenAI / Azure OpenAI** cap output with `max_completion_tokens`.
- **Gateway model.** The LLM Gateway now has its own model field instead of sharing the Direct Provider's. Existing settings are migrated.
- **UI rebuilt on the Quilr AI Design System.** Real logo, ported components, verdict-led color.
- **Settings.** The non-functional Theme and Language controls were removed. The tabs are now Providers, Gateways, and Requests.

### Fixed
- Gateways serving Anthropic's Messages API (`/v1/messages`) failed with `messages.0: use the top-level 'system' parameter…` because the system prompt was sent as an OpenAI-style first message. Gateways now have an **API format** setting (OpenAI Chat Completions or Anthropic Messages), inferred from the path for existing profiles.
- Claude behind an LLM Gateway or OpenRouter failed with `Missing required parameter: 'max_tokens'`. Gateways now send `max_tokens` by default (configurable per gateway), and Anthropic never receives an invalid value.
- Streamed replies from OpenAI-compatible providers never reported token usage (`stream_options.include_usage` was not sent).
- Anthropic streaming dropped input-token counts.
- Multi-byte characters (Devanagari, CJK, emoji) could be corrupted when split across network chunks.
- Error replies were sent back to the model as conversation history on the next turn.
- Stopping a reply in the browser didn't cancel the upstream request, so tokens kept being billed.
- Gateway HTML block pages produced a generic "HTTP 403" instead of their message.
- Anthropic and Bedrock rejected conversations that didn't strictly alternate turns (for example after a retry or a failed reply). History is now normalized.
