# Deployment & Local Setup

QuilrBot runs identically on Windows, macOS, and Linux — it is a Node.js application with no OS-specific dependencies (no Python required, unlike the original repository).

## Prerequisites

- **Node.js 18.18 or newer** (Node 20/22 recommended). Verify with `node -v`.
  - macOS: `brew install node`, or download from https://nodejs.org
  - Windows: download the installer from https://nodejs.org, or `winget install OpenJS.NodeJS.LTS`
- npm ships with Node — no separate install needed. `npm -v` should print `9.x` or newer.

## First-time setup

```bash
# 1. Unzip / copy the QuilrBot folder, then from its root:
cd QuilrBot

# 2. Install dependencies for both the server and the client
npm install

# 3. Configure environment variables
cp .env.example server/.env
# Edit server/.env if you want to pre-seed default provider keys or change ports.
# The defaults work out of the box with no edits.
```

> **Windows note:** use PowerShell or Command Prompt for these commands; `cp` is not available in `cmd.exe` — use `copy .env.example server\.env` instead.

## Running QuilrBot locally

```bash
npm run dev
```

This starts both processes concurrently:

- **QuilrBot Server** (API relay) on `http://localhost:4501`
- **QuilrBot Client** (web UI) on `http://localhost:4500`

Open **http://localhost:4500** in your browser. The client's Vite dev server proxies every `/api/*` request to the server, so no separate CORS configuration is needed in development.

Stop both processes with `Ctrl+C`.

## Building for production use

```bash
npm run build       # type-checks and builds both server (to server/dist) and client (to client/dist)
npm start            # runs the built server from server/dist/index.js
```

In production mode, serve `client/dist` with any static file server (or extend `server/src/index.ts` with `express.static('../client/dist')` if you want QuilrBot to serve its own UI from the same process/port). Set `QUILRBOT_ALLOWED_ORIGIN` in `server/.env` to match wherever the built client is served from.

## Running the two processes separately

Useful for debugging one side in isolation:

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

## Ports

| Process | Default port | Env var |
|---|---|---|
| Client (Vite dev server) | 4500 | `QUILRBOT_CLIENT_PORT` (also update `client/vite.config.ts` if changed) |
| Server (Express API) | 4501 | `QUILRBOT_SERVER_PORT` |

If either port is already in use on your machine, stop the conflicting process or change the port in `.env` (server) and `client/vite.config.ts` (client — the dev-server proxy target must match `QUILRBOT_SERVER_PORT`).

## Troubleshooting

- **"Could not reach the QuilrBot relay"** in the UI — the server isn't running, or is running on a different port than the client's proxy target. Check the server terminal output for `QuilrBot API server listening on http://localhost:4501`.
- **Native module / esbuild errors after copying the project between machines** — delete `node_modules` (root, `server/`, and `client/`) and re-run `npm install` on the machine you intend to run QuilrBot on. Native binaries (esbuild, Vite's dependencies) are platform-specific and cannot be copied between Linux/macOS/Windows.
- **A saved provider or gateway won't decrypt** — this means `server/data/.encryption-key` was regenerated (e.g. the file was deleted) after secrets were saved with a previous key. Re-save the affected profiles, or set a stable `QUILRBOT_ENCRYPTION_KEY` in `server/.env` up front to avoid this entirely.
