# Storage & Persistence Design

QuilrBot runs as a local, single-tenant desktop-style application (one user, one machine, started with `npm run dev`), the same operating model as the original repository. Storage design follows from that: there is no multi-tenant database, no network-accessible persistence layer, and no server cluster to synchronize state across.

## What is stored, and where

| Data | Location | Persisted? | Encrypted? |
|---|---|---|---|
| Conversations (messages, titles, timestamps) | Browser `localStorage`, namespaced `quilrbot:v1:conversations` | Yes | No — never contains secrets |
| Active connection mode, non-secret provider/gateway fields (provider id, model, base URL, header **names**), system prompt | Browser `localStorage` | Yes | No |
| API keys / gateway credentials typed into the composer | React state (memory only) | No — cleared on refresh unless explicitly saved | N/A |
| Saved provider profiles (name, provider id, model, base URL, headers, **encrypted API key**) | `server/data/store.json` | Yes | Yes — AES-256-GCM |
| Saved gateway profiles (name, base URL, endpoint path, auth method, headers, **encrypted credential**) | `server/data/store.json` | Yes | Yes — AES-256-GCM |
| App settings (theme, language, request timeout, streaming toggle, debug mode, default gateway id) | `server/data/store.json` | Yes | No — contains no secrets |
| Encryption key for the store | `server/data/.encryption-key` (auto-generated on first run) or `QUILRBOT_ENCRYPTION_KEY` env var | Yes | N/A (the key itself) |

## Why a JSON file instead of a database

A single JSON file behind a small `jsonStore` module (`server/src/storage/jsonStore.ts`) was chosen over SQLite/Postgres/Mongo because:

1. **Access pattern** — QuilrBot has one reader/writer process, one user, and a handful of small collections (saved providers, saved gateways, one settings object). There is no concurrent-writer problem to solve.
2. **Zero external dependencies** — no database binary, driver, or migration tool to install on a user's Windows or macOS machine before QuilrBot can run.
3. **Inspectability** — a support engineer or the user themselves can open `server/data/store.json` in a text editor and see exactly what QuilrBot has stored, which matters for a security/gateway-adjacent tool where "what does this app know about me" is a reasonable question to be able to answer at a glance.
4. **Read/modify/write is sufficient** — `jsonStore.update()` reads the whole file, mutates it, and writes it back synchronously per request. At the request volumes this app sees (interactive, single-user), this is not a bottleneck.

## Encryption at rest

Secrets (`apiKey` fields on saved provider/gateway profiles) are encrypted with AES-256-GCM (`server/src/storage/crypto.ts`) before being written to `store.json`, using a 32-byte key that is either supplied via `QUILRBOT_ENCRYPTION_KEY` or generated once and cached in `server/data/.encryption-key` (which is `.gitignore`d, mode `0600`). Ciphertext is stored as `v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>`, so the format is versioned for a future migration if the scheme ever changes. Everywhere a saved profile is *listed* (for the Settings UI), the API returns a boolean `hasApiKey` rather than the key itself; the key is only ever decrypted and returned by the explicit `/reveal` endpoints, which exist solely so the client can populate the in-memory composer state when a user clicks "Load."

## Upgrade path to a real database

If QuilrBot ever needs to run multi-tenant (e.g. as a hosted service rather than a local client), the intended migration is:

1. Replace `jsonStore.ts`'s read/write functions with a repository backed by Postgres (or any relational store) — `ProviderService`, `GatewayService`, and `ConfigurationService` already treat storage as an opaque dependency, so this is the only file that needs to change.
2. Move secret encryption from a local static key to a managed KMS (AWS KMS, GCP KMS, HashiCorp Vault) and scope the store by an authenticated `tenantId`/`userId` rather than a single global file.
3. Move conversation history from client-only `localStorage` to a server-side `conversations` table keyed by user, so history survives across browsers/devices.

None of the service or route interfaces need to change for this migration — only the storage implementation behind them.
