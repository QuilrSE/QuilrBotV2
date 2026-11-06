# Migration Plan — CatoVerse → QuilrBot

File-by-file mapping from the original repository to the new QuilrBot codebase, plus what changed and why.

| Original file | Fate | QuilrBot equivalent | Notes |
|---|---|---|---|
| `backend_server.py` (Python stdlib relay) | Replaced | `server/src/index.ts` + `server/src/routes/*` + `server/src/services/ChatService.ts` | Rewritten in TypeScript/Express. The two hardcoded routes (`/api/direct-chat`, `/api/proxy-chat`) become one provider-agnostic `POST /api/chat/stream`, plus new CRUD routes for providers/gateways/settings. Streaming added (original was blocking request/response). |
| `run.py` | Replaced | root `package.json` scripts (`npm run dev`) via `concurrently` | Node-only launcher; no Python dependency anywhere in the new stack. |
| `index.html`, `src/main.tsx` | Migrated | `client/index.html`, `client/src/main.tsx` | Title/branding changed to QuilrBot; same Vite/React bootstrap pattern. |
| `src/App.tsx` (monolithic state + layout) | Replaced | `client/src/App.tsx` (layout only) + `client/src/state/AppStateContext.tsx` (all state) | State extracted from the component tree into a reducer-based context so Settings, Models, and Gateway pages can share it. |
| `src/types.ts` | Replaced | `server/src/types/index.ts` + `client/src/types/index.ts` | Expanded from a two-mode, Gemini-only shape into provider/gateway-agnostic types (`ProviderDefinition`, `GatewayConfig`, `HeaderEntry`, `NormalizedStreamEvent`, etc.). |
| `src/components/ModeSelector.tsx` | Replaced | `client/src/components/connection/ConnectionModeSwitch.tsx` | Renamed "Direct AI / Cato AI Proxy" → "Direct Provider / LLM Gateway"; same pill-toggle interaction pattern. |
| `src/components/SettingsPanel.tsx` (mixed connection + secret UI) | Replaced | `client/src/components/connection/ProviderForm.tsx`, `GatewayForm.tsx`, `HeaderEditor.tsx` | Split into a provider form (works for any of 9 registered providers) and a gateway form (generic base URL + endpoint path + auth method + dynamic headers), instead of one Gemini-shaped form. |
| `src/components/ChatWindow.tsx` | Migrated & expanded | `client/src/components/chat/ChatWindow.tsx` | Now composes the connection bar, notice banner, message list, and composer; adds streaming/cancel support. |
| `src/components/MessageList.tsx` | Replaced | `client/src/components/chat/MessageList.tsx` + `MessageBubble.tsx` + `MarkdownRenderer.tsx` | Original rendered plain `<p>` text. QuilrBot adds Markdown rendering, code syntax highlighting, per-message copy/retry, and token-usage display. |
| `src/components/ChatInput.tsx` | Migrated | `client/src/components/chat/Composer.tsx` | Same Ctrl/Cmd+Enter-to-send interaction; adds a Stop button while streaming. |
| `src/components/PacketFlowDiagram.tsx` (built but unused) | Dropped | — | Superseded by the always-visible Right Panel (Connection Details / Provider Details / Headers / Request Metadata / Token Metrics), which conveys the same "where is this request going" information without a bespoke SVG diagram. |
| `src/services/gemini.ts` | Replaced | `server/src/adapters/openaiAdapter.ts` | Gemini-specific OpenAI-shaped call becomes one of many providers using the shared OpenAI adapter. |
| `src/services/proxy.ts` (Gemini `generateContent` proxy rewriting) | Replaced | `server/src/services/ChatService.ts` (gateway branch) + `server/src/adapters/openaiAdapter.ts` | The new Gateway mode assumes an OpenAI-compatible upstream (the modern norm for enterprise LLM gateways) instead of rewriting into a vendor-specific `generateContent` body — this is what makes Gateway mode provider-agnostic instead of Gemini-only. |
| `src/utils/chat.ts` (`DEFAULT_SETTINGS` hardcoded to Gemini + a Cato base URL) | Replaced | `client/src/state/defaults.ts` | Defaults are now provider-neutral (`openai` / `gpt-4o-mini`); no vendor base URL ships as a default. |
| `src/utils/masking.ts` | Migrated | `client/src/utils/masking.ts` + `server/src/utils/headers.ts` (`maskHeaderMap`/`maskSecret`) | Same masking heuristic (mask header/field values whose name looks secret-bearing), now available on both sides of the wire. |
| `src/utils/storage.ts` | Replaced | `client/src/utils/storage.ts` + `state/AppStateContext.tsx` persistence effects | Original persisted one settings object under one key. QuilrBot persists connection prefs, system prompt, and full conversation history (see `STORAGE_DESIGN.md`), still never persisting API keys client-side. |
| `src/utils/validation.ts` | Replaced | `client/src/utils/validation.ts` + `server/src/services/HeaderManagementService.ts` | Validation generalized from "Gemini key + Cato headers JSON" to per-mode field validation for any registered provider or gateway, plus dynamic header-row validation (duplicate names, empty rows). |
| `src/index.css` (Gemini/Cato dark theme) | Replaced | `client/src/styles/globals.css` | Full QuilrAI palette applied (`#0B1020` background, `#131A2E` panels, `#5B8CFF` primary, `#7B5CFF` accent, `#22C55E` success) with glassmorphism panels, large spacing, and a left-nav + main + right-panel layout instead of the original's single-column hero-and-form page. |
| `README.md` | Replaced | root `README.md` | Rewritten for QuilrBot: multi-provider setup, gateway configuration, environment variables, deployment. |
| *(none — new capability)* | Added | `server/src/services/ProviderService.ts`, `GatewayService.ts`, `ConfigurationService.ts` + `server/src/storage/` | The original had no server-side persistence at all. QuilrBot adds encrypted-at-rest saved connection profiles and app settings, exposed through the new Settings, Models, and Gateway Connections pages. |
| *(none — new capability)* | Added | `client/src/components/settings/*`, `client/src/components/pages/*` | The original had zero navigation — one page did everything. QuilrBot adds the full left-nav IA (Chat, Models, Gateway Connections, Settings) required by the brief. |

## Terminology replacement table

Every user-facing and internal reference to the original vendor was renamed. A small sample:

| Old term | New term |
|---|---|
| CatoVerse | QuilrBot |
| Cato AI Proxy | LLM Gateway |
| Cato Guard key | Gateway credential |
| `x-aim-session-id`, `x-aim-user-email` | Removed — replaced by user-defined custom headers |
| "Cato AI Security blocked this request..." | Generic upstream error message surfaced from the adapter's `parseErrorPayload` |
| `local-cato-chat:preferences` (localStorage key) | `quilrbot:v1:*` namespaced keys |
| `DEFAULT_CATO_PROXY_BASE` / `catonetworks.com` default URL | No hardcoded vendor URL; gateway base URL is blank until the user configures it |

A repository-wide case-insensitive search for `cato` returns zero matches in the QuilrBot source tree (verified as part of the final QA pass).
