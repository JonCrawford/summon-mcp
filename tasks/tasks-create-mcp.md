## Relevant Files

- `package.json` – NPM project configuration and dependencies.
- `package-lock.json` – NPM dependency lock file for reproducible installs.
- `tsconfig.json` – TypeScript compiler configuration with ES2022 target.
- `vitest.config.ts` – Vitest configuration with ES module support (created).
- `src/server.ts` – FastMCP bootstrap and server start-up (created with Express OAuth routes).
- `src/quickbooks.ts` – Helper for OAuth token handling and returning an authenticated QuickBooks client (created).
- `src/tools/index.ts` – Factory that registers one read-only tool per QuickBooks entity (created).
- `src/tools/entities.ts` – Central list mapping QBO entities to SDK function names (created).
- `tokens.json` – Local file to persist access & refresh tokens.
- `.env` – Runtime environment variables (not checked in).
- `.env.example` – Template showing required env vars (created).
- `tests/setupPolly.ts` – PollyJS configuration for HTTP recording/replaying (created).
- `tests/oauth.test.ts` – Unit tests for OAuth helper and token persistence (created).
- `tests/tools.test.ts` – Integration tests for generated tools using PollyJS fixtures (created).
- `tests/health.test.ts` – Health-check endpoint test (created).
- `polly/fixtures/**/*.json` – Recorded QuickBooks API interactions for replay.

### Notes

- Unit tests live under `tests/` with the same filename prefix as the code they cover.
- Run all tests with `npm test` (alias for `vitest run`).
- Recorded HTTP fixtures are version-controlled to prevent API drift; regenerate with `VCR_MODE=record npm test`.

---

## Tasks

- [x] **1.0 Project bootstrap & dependencies**
  - [x] 1.1 Initialize a new npm project (`npm init -y`).
  - [x] 1.2 Install runtime deps: `fastmcp`, `dotenv`, `intuit-oauth`, `node-quickbooks`, `zod`.
  - [x] 1.3 Install dev deps: `typescript`, `tsx`, `@types/node`, `vitest`, `@pollyjs/core`, `@pollyjs/adapter-node-http`, `@pollyjs/persister-fs`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`.
  - [x] 1.4 Add `tsconfig.json`, configure ES2022 target & moduleResolution `node`.
  - [x] 1.5 Add npm scripts: `start`, `test`, `lint`, `dev`.
  - [x] 1.6 Commit `.env.example` with placeholders for `INTUIT_CLIENT_ID`, `INTUIT_CLIENT_SECRET`, and `PORT`.

- [x] **2.0 Implement QuickBooks OAuth handshake**
  - [x] 2.1 Create `src/quickbooks.ts`; initialize `OAuthClient` using env vars.
  - [x] 2.2 Implement `getAuthorizeUrl()` returning Intuit auth URL.
  - [x] 2.3 Implement `handleCallback(url)` that exchanges code for tokens and writes `tokens.json`.
  - [x] 2.4 Implement `getQBOClient()` which loads tokens, refreshes if expired, and returns authenticated `QuickBooks` instance.
  - [x] 2.5 Expose `/connect` and `/callback` routes via FastMCP Resource or minimal Express shim so a user can trigger the OAuth flow.

- [x] **3.0 Bootstrap FastMCP server with basic health endpoint**
  - [x] 3.1 Create `src/server.ts`; initialize `FastMCP` metadata (name, version).
  - [x] 3.2 Configure HTTP transport on `process.env.PORT || 8080`.
  - [x] 3.3 Add `tool.health_check` that returns "OK" to verify server is alive.
  - [x] 3.4 Verify `npm start` launches server and health check passes.

- [x] **4.0 Implement QuickBooks Tool Factory (one tool per entity)**
  - [x] 4.1 Create `src/tools/entities.ts` with an array of `{ name, sdkFn }` mappings for key entities (Customer, Invoice, Payment, Transaction, Report).
  - [x] 4.2 In `src/tools/index.ts`, iterate the mapping and call `server.addTool()` for each.
  - [x] 4.3 For each tool, define Zod parameters: `startDate`, `endDate`, `limit` (default 20).
  - [x] 4.4 Implement `execute` that calls the appropriate `QuickBooks` SDK function and returns JSON stringified results.
  - [x] 4.5 Include error handling for missing tokens or 401 responses.
  - [x] 4.6 Add optional P&L report tool (`tool.qb.report_pnl`).

- [x] **5.0 Set up Vitest + PollyJS testing scaffold**
  - [x] 5.1 Configure `vitest.config.ts` with ES module support and tsx transform.
  - [x] 5.2 Add PollyJS setup file (`tests/setupPolly.ts`) for recording & replaying HTTP.
  - [x] 5.3 Write `oauth.test.ts` to assert authorize URL shape and token persistence (mock fetch).
  - [x] 5.4 Write `tools.test.ts` to run a sample entity tool using Polly fixtures.
  - [x] 5.5 Write `health.test.ts` to call the health-check tool and expect "OK".
