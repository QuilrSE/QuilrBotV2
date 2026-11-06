# QuilrBot UI Design Specification

## Source of truth

QuilrBot is built on the **Quilr AI Design System** (the published design-system artifact).

- **Tokens.** The `:root` block in `client/src/styles/globals.css` holds the system's
  colors, type, spacing, radii, shadows and motion, value for value from its `tokens.json`.
- **Components.** `client/src/components/ui/` ports the system's components from inline-style
  JSX to class-based TSX, so hover, `:focus-visible` and reduced-motion states work in CSS:

| Design system | QuilrBot | Used for |
|---|---|---|
| `core/Button` | `Button`, `IconButton` | primary (mint), gradient (New chat), outline, ghost, danger (Stop) |
| `core/Badge` | `Badge` | status pills: Ready to send, Streaming, connection summaries, dialect labels |
| `core/Card` | `Card` | inspector panels, settings sections, model cards (`accentEdge` on Bedrock) |
| `product/GuardrailChip` | `GuardrailChip` | verdict on every reply, per-column tallies in Split View |
| `brand/Logo` | `Logo` | sidebar lockup (`/brand/quilr-logo.png`, the real asset) |

`GuardrailChip` gains one verdict, **fail** (amber `--status-warn`, warning-triangle glyph),
so a misconfiguration is never shown as a block. Field, Segmented and Switch are
QuilrBot additions built only from system tokens.

## Principles

- **The verdict is the signal.** Color carries meaning, used sparingly: mint = allowed or
  ready, pink = blocked or threat, amber = failed or incomplete, purple = the agent
  (assistant avatar, streaming). Everything else stays ink and hairlines.
- **The aurora appears once.** `aurora-scene.jpg` is used only as the empty-state backdrop.
- **Telemetry in mono.** Tokens, latency, model ids, endpoints and masked credentials use
  Roboto Mono; everything else uses Sora (UI) or Roboto (body).
- **No emoji.** Lucide icons, stroke 1.75.

## Layout

```
┌──────────┬────────────────────────────────────────────┬─────────────┐
│ Sidebar  │ Top bar: title · status badge              │ Inspector   │
│  Logo    ├────────────────────────────────────────────┤ (Chat only) │
│  New chat│ Connection bar: mode · summary · Split View│  per channel│
│  Nav     │ [Connection panel, collapsible]            │  endpoint,  │
│  Convos  ├────────────────────────────────────────────┤  dialect,   │
│          │ Thread (or Split View: two columns,        │  region,    │
│          │   each with a verdict tally)               │  auth,      │
│          ├────────────────────────────────────────────┤  headers    │
│          │ Quick Prompt · Composer                    │             │
└──────────┴────────────────────────────────────────────┴─────────────┘
```

Breakpoints: above 1240px, three columns; 820–1240px, the inspector is hidden; below 820px,
a single column (sidebar hidden, forms single-column, Split View stacks).

## Messages

- **User:** right-aligned ink-700 bubble.
- **Assistant:** unboxed text beside a gradient (agentic) avatar. The avatar turns pink
  when blocked and grey when failed.
- **Meta row:** role, channel tag (only when a conversation mixes both channels), verdict
  chip (with HTTP status for blocked or failed), time. Copy and retry appear on hover.
- **Footer telemetry:** `prompt → completion tokens`, latency, responding model.
- **Errors and blocks:** a tinted box (pink for blocked, amber for failed) holding the
  upstream message. HTML block pages are reduced to text by the relay.

## Bedrock connection form

Provider, model or inference profile (with suggestions), AWS region, auth method
(Segmented: *Bedrock API key* / *IAM access keys*), then either the API key or the
access key ID, secret and optional session token, and an optional VPC endpoint. When the
server holds AWS credentials, the credential fields become optional and say so.

## Gateway connection form

Name, model, base URL, **API format** (OpenAI Chat Completions or Anthropic Messages), endpoint
path, output token limit (OpenAI format only), authorization, credential, and custom headers.
Changing the format swaps the endpoint path between `/chat/completions` and `/v1/messages`
if it is still a default. Typing a recognizable path selects the matching format.

## Accessibility

- Every field has a `<label>`; errors and hints are linked with `aria-describedby`.
- Segmented controls use `role="radiogroup"`.
- The thread is an `aria-live="polite"` log.
- Focus is shown with the system's 3px mint ring.
- `prefers-reduced-motion` disables all motion.

## Known gaps

- **No light theme.** The design system has no light-surface logo yet, so the old
  Light (preview) option was removed rather than shipped half-done.
- **Iconography.** The system flags Lucide as a stand-in for Quilr's bespoke SVG set.
  Swap it in when that set is available.
