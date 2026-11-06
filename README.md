# QuilrBot

QuilrBot is an enterprise AI gateway client. It connects directly to LLM providers (OpenAI, Azure OpenAI, Anthropic, **AWS Bedrock**, Google Gemini, Mistral, Cohere, Groq, DeepSeek, OpenRouter) or through an Enterprise LLM Gateway, lets you test and compare models and guardrails, configure custom headers and base URLs, and chat through a streaming, markdown-rendering interface.

## Features

- **AWS Bedrock** — any Bedrock model via the Converse API, authenticated with a Bedrock API key or IAM access keys (SigV4-signed by the relay, no AWS SDK needed). Region picker, inference profiles and ARNs, VPC endpoints, and server-side AWS credentials. See `docs/PROVIDER_ENDPOINTS.md`.
- **Guardrail verdicts** — every reply is marked **Allowed**, **Blocked**, or **Failed**. Split View tallies verdicts per channel, so you can see what your gateway stops that the provider lets through. Credential and configuration errors are always "Failed", never "Blocked".
- **Two connection modes** — Direct Provider (pick a registered provider, model, API key, optional base URL override) and LLM Gateway (name, base URL, endpoint path, authorization method, unlimited custom headers).
- **Split View** — send the same prompt to the Direct Provider and the LLM Gateway simultaneously and watch both responses stream side by side, independently, in real time.
- **Provider-agnostic core** — every direct provider is a configuration entry (`server/src/config/providers.config.ts`); adding one never requires touching adapter, service, or UI code.
- **Streaming chat** — token-by-token responses over Server-Sent Events, for both provider and gateway modes.
- **Markdown + code highlighting** — GitHub-flavored Markdown with syntax-highlighted code blocks in every message.
- **Message history, copy, retry, clear** — per-conversation transcript with copy-to-clipboard, retry-last-response, and clear-conversation actions.
- **Token usage, latency & connection visibility** — prompt/completion tokens, latency and responding model under every reply; a right-hand inspector shows the endpoint, dialect, region, auth method, masked credential and headers for each channel.
- **Server-side credentials** — set provider keys (or AWS credentials) in `server/.env` and the browser never needs to see them.
- **Saved Provider & Gateway Connections** — dedicated left-nav pages (mirroring each other) for saving, loading, and deleting named connection profiles, with credentials encrypted at rest.
- **Quick Prompt** — a collapsible library of preset red-team prompts (Leak PII, Leak a secret, Jailbreak, Prompt Injection) for exercising an AI security gateway's guardrails; selecting one populates the composer without auto-sending.
- **Settings** — Providers (saved profiles; API keys and AWS secrets encrypted at rest), Gateways (saved profiles, default gateway), Requests (timeout, max output tokens, streaming, debug logging).
- **Quilr AI Design System** — tokens copied from the published system, with its Button, Badge, Card, GuardrailChip and Logo components ported to `client/src/components/ui/`; see `docs/UI_DESIGN_SPEC.md`.

## Quick start

```bash
npm install
cp .env.example server/.env   # Windows: copy .env.example server\.env
npm run dev
```

Open **http://localhost:4500**. Run the server test suite with `npm test`. See `docs/DEPLOYMENT.md` for full setup, production build, and troubleshooting instructions.

## Project structure

```
QuilrBot/
├── server/                    # Express + TypeScript API relay
│   └── src/
│       ├── config/            # Provider registry (config-only provider registration)
│       ├── adapters/          # openai / anthropic / bedrock-converse dialects,
│       │                      #   SSE framing + AWS event-stream decoder
│       ├── services/          # ChatService, ProviderService, GatewayService,
│       │                      #   ConfigurationService, HeaderManagementService,
│       │                      #   aws/sigv4 (request signing)
│       ├── utils/             # endpoint resolution, guardrail verdicts
│       ├── routes/            # chat, providers, gateways, settings, health
│       └── storage/           # JSON store + AES-256-GCM secret encryption
├── client/                     # React + Vite + TypeScript web UI
│   └── src/
│       ├── state/              # AppStateContext (reducer-based global state)
│       ├── hooks/               # useStreamingChat
│       ├── services/            # client-side API wrappers
│       └── components/
│           ├── ui/              # Design-system primitives: Button, Badge, Card,
│           │                    #   GuardrailChip, Logo, Field, Segmented, Switch
│           ├── layout/          # Sidebar, TopBar, RightPanel
│           ├── chat/            # ChatWindow, MessageList, MessageBubble, Composer
│           ├── connection/      # ConnectionModeSwitch, ProviderForm, GatewayForm, HeaderEditor
│           ├── settings/        # SettingsPage + General/Provider/Gateway/Advanced tabs
│           └── pages/           # ModelsPage, ProvidersPage, GatewaysPage
└── docs/                        # Architecture, migration plan, UI spec, storage design,
                                  #   deployment guide, roadmap
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture overview, including a reverse-engineering summary of the legacy application this project replaces.
- [`docs/MIGRATION_PLAN.md`](docs/MIGRATION_PLAN.md) — file-by-file mapping from the legacy codebase to QuilrBot.
- [`docs/UI_DESIGN_SPEC.md`](docs/UI_DESIGN_SPEC.md) — design language, palette, and information architecture.
- [`docs/STORAGE_DESIGN.md`](docs/STORAGE_DESIGN.md) — what is persisted, where, and how secrets are encrypted at rest.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Windows/macOS setup, production build, troubleshooting.
- [`docs/PROVIDER_ENDPOINTS.md`](docs/PROVIDER_ENDPOINTS.md) — every provider's endpoint, auth and message format, Bedrock details, and how verdicts are decided.
- [`CHANGELOG.md`](CHANGELOG.md) — what changed in 2.0.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — future enhancement recommendations.
- [`.env.example`](.env.example) — full environment variable specification.

## Adding a new provider

Add one entry to `PROVIDER_REGISTRY` in `server/src/config/providers.config.ts`:

```ts
{
  id: 'my-provider',
  label: 'My Provider',
  description: 'Models via My Provider’s OpenAI-compatible endpoint.',
  apiStyle: 'openai',
  defaultBaseUrl: 'https://api.myprovider.com/v1',
  chatPath: '/chat/completions',
  authHeaderStyle: 'bearer',
  defaultModels: ['my-model-large', 'my-model-small'],
  allowsBaseUrlOverride: false,
  supportsStreaming: true,
}
```

Bedrock-style providers can also use `{region}` in `defaultBaseUrl`, `{model}` in `chatPath`, a separate `streamChatPath`, and a `regions` list. That's it — no other file needs to change. It will immediately appear in the Direct Provider dropdown, the Models page, and Settings > Providers.

## License

Provided as-is for internal / evaluation use.
