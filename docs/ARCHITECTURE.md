# QuilrBot — Architecture Overview

This document covers two things: (1) a reverse-engineering summary of the original repository this project replaces, and (2) the architecture of QuilrBot, the independent product built to replace it.

## 1. Reverse-engineering summary of the original repository

The original repository was a small local chatbot demo (package name `gemini-chat-dual-mode`) with two connection modes: a "Direct AI" mode that called Google Gemini's OpenAI-compatibility endpoint, and a proxy mode that forwarded the same conversation through a vendor AI security gateway with a Gemini-specific `generateContent` payload shape.

**Frontend architecture.** A single-page React 18 + TypeScript app built with Vite. There was no router and no component library — one `App.tsx` held nearly all state via `useState`, and five presentational components (`ModeSelector`, `SettingsPanel`, `ChatWindow`, `MessageList`, `ChatInput`) rendered it. Styling was hand-written CSS using custom properties for a dark theme with soft gradients — no Tailwind, no CSS modules.

**Backend architecture.** A dependency-free Python 3 `http.server` script (`backend_server.py`) exposed exactly two routes: `/api/direct-chat` (forwarded to Gemini's OpenAI-compatible endpoint with a Bearer key) and `/api/proxy-chat` (rewrote the OpenAI-shaped conversation into Gemini's native `generateContent` request body and forwarded it to a configurable base URL with a vendor-specific `x-goog-api-key` header, an auto-generated session id, and optional custom headers). Neither route streamed — both were single blocking request/response calls using `urllib.request`.

**API communication flow.** Browser → Vite dev-server proxy (`/api/*` → `127.0.0.1:4501`) → Python relay → upstream (Gemini directly, or Gemini via the gateway's `generateContent` path). The relay existed only to avoid CORS restrictions and to keep the API key out of any gateway-side logging by attaching it as a header server-side — the frontend still held the plaintext key in memory.

**State management.** Local component state only (`useState`/`useEffect` in `App.tsx`); no context, no external store, no server-persisted conversation history.

**Configuration management.** A single `AppSettings` object (`mode`, `direct`, `proxy`) persisted to `localStorage` under one key, with the API key deliberately stripped before every write so it never touched disk.

**UI component hierarchy.** `App` → (`ModeSelector`, `SettingsPanel`, `ChatWindow` → `MessageList`, `ChatInput`). A `PacketFlowDiagram` component existed in source but was not wired into `App.tsx`.

**Design system and styling.** Plain CSS with a dark palette, radial-gradient ambient backgrounds, glass-like panels via `backdrop-filter: blur()`, and pill-shaped buttons — a solid visual baseline but entirely bespoke, undocumented, and hardcoded to the Gemini/gateway branding.

**Build and deployment.** `run.py` was the single entry point: it picked a package manager, ran `npm install` if `node_modules` was missing, spawned the Python relay as a subprocess, then ran `vite dev`. No production build/deploy path, no containerization, no environment-variable driven configuration — the gateway base URL was a hardcoded default string in source.

**Why this had to be fully rebuilt, not just renamed.** The original was hardwired to one model family (Gemini) and one gateway vendor's request shape (`generateContent` rewriting, vendor-specific headers). None of it was provider-agnostic, there was no persistence beyond one browser tab, no streaming, and no settings surface beyond the two connection forms. Every requirement in the QuilrBot brief — multi-provider support, a generic Enterprise LLM Gateway mode, streaming, saved connection profiles, a Settings page — required new architecture, not a coat of paint.

## 2. QuilrBot architecture

QuilrBot is a two-process local application, same shape as the original (a browser client talking to a local relay) but rebuilt around a provider-agnostic core.

```
┌─────────────────────┐        ┌──────────────────────────┐        ┌───────────────────────┐
│   QuilrBot Client    │  HTTP  │      QuilrBot Server      │  HTTP  │   Upstream (Direct     │
│  React + Vite (4500) │ ─────▶ │  Express + TS   (4501)    │ ─────▶ │  Provider or Gateway)  │
└─────────────────────┘        └──────────────────────────┘        └───────────────────────┘
        │  localStorage:                     │  data/store.json:
        │  UI prefs, conversations            │  saved providers/gateways (AES-256-GCM),
        │  (non-secret)                       │  general/advanced settings
```

### Server (`server/`)

- **`config/providers.config.ts`** — the provider registry. Every direct LLM provider (OpenAI, Azure OpenAI, Anthropic, Google Gemini, Mistral, Cohere, Groq, DeepSeek, OpenRouter) is one `ProviderDefinition` object: base URL, chat path, auth header style, static headers, default models. No provider-specific branching exists anywhere else — see "Adding a provider" below.
- **`adapters/`** — exactly two wire-format adapters: `openaiAdapter` (OpenAI `/chat/completions` dialect — covers OpenAI, Azure OpenAI, Gemini's OpenAI-compatible endpoint, Mistral, Cohere, Groq, DeepSeek, OpenRouter, and every Enterprise Gateway) and `anthropicAdapter` (native Anthropic Messages API). Each adapter knows how to build an upstream request body and how to turn a streamed or non-streamed upstream response into QuilrBot's normalized `NormalizedStreamEvent` protocol (`delta` / `done` / `error`).
- **`services/`** — `ChatService` (resolves a request to a URL + headers + adapter, then streams), `ProviderService` and `GatewayService` (CRUD over saved connection profiles, secrets encrypted at rest), `ConfigurationService` (General/Advanced settings), `HeaderManagementService` (all header-construction and validation rules, shared by both provider and gateway paths).
- **`routes/`** — thin Express routers (`chat`, `providers`, `gateways`, `settings`, `health`) that only parse the request and call the matching service.
- **`storage/jsonStore.ts`** + **`storage/crypto.ts`** — a file-based JSON store with AES-256-GCM encryption for any persisted secret. See `STORAGE_DESIGN.md`.

### Client (`client/`)

- **`state/AppStateContext.tsx`** — a single React Context + `useReducer` store holding connection mode, provider/gateway connection state, conversations, streaming status, notices, and data fetched from the server (provider catalog, saved profiles, settings). Non-secret slices are persisted to `localStorage`; API keys are held in memory only unless the user explicitly saves a profile through Settings.
- **`hooks/useStreamingChat.ts`** — orchestrates sending a message: validates the active connection, builds the wire payload, opens the SSE stream via `ChatService` (client), and dispatches deltas into the active conversation as they arrive.
- **`services/`** — thin client wrappers (`chatApi`, `providerApi`, `gatewayApi`, `settingsApi`, `headerManagementService`) that mirror the server's service names so the same mental model applies on both sides of the wire.
- **`components/`** — `layout/` (Sidebar, TopBar, RightPanel), `chat/` (ChatWindow, MessageList, MessageBubble, Composer, MarkdownRenderer), `connection/` (ConnectionModeSwitch, ProviderForm, GatewayForm, HeaderEditor, ConnectionBar), `settings/` (SettingsPage + General/Provider/Gateway/Advanced tabs), `pages/` (ModelsPage, GatewaysPage).

### Provider-agnostic request flow

1. The client builds a `ChatStreamPayload` describing *what* to ask (`messages`, `systemPrompt`, `model`) and *how to reach it* (`mode: 'provider' | 'gateway'`, plus the relevant connection block) and POSTs it to `POST /api/chat/stream`.
2. `ChatService.resolveUpstream` looks up the provider definition (or reads the inline gateway config), builds the final URL and header set via `HeaderManagementService`, and picks an adapter by `apiStyle`.
3. The adapter shapes the upstream request body and, as bytes stream back, translates each provider-native frame into a normalized `{type: 'delta'|'done'|'error', ...}` event.
4. The server re-emits those normalized events over its own SSE stream to the browser; the browser never sees provider-specific wire formats, and the provider never sees anything client-specific.

`/api/chat/stream` is otherwise stateless and knows nothing about "Split View" — the client's `useStreamingChat` hook simply opens two independent SSE connections (one `mode: 'provider'` payload, one `mode: 'gateway'` payload) for the same prompt and reconciles both streams client-side. No server change was needed to support sending to both channels at once.

### Adding a new provider (config-only)

To register a new OpenAI-compatible provider, add one object to `PROVIDER_REGISTRY` in `server/src/config/providers.config.ts` with its base URL, auth header style, and default models — no other file changes. If the provider needs a genuinely new wire dialect (not OpenAI- or Anthropic-shaped), implement one adapter satisfying the `Adapter` interface in `server/src/adapters/` and register it in `server/src/adapters/index.ts`; `ChatService` and every route/UI component remain untouched.
