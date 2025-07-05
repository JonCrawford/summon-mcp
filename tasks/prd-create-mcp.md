# PRD – QuickBooks MCP Server (Proof of Concept)

## 1. Introduction / Overview
Accounting pros waste minutes clicking around multiple QuickBooks Online (QBO) companies to answer simple questions.  
**The QuickBooks MCP Server** lets them ask natural-language questions via Claude Desktop and get instant, read-only answers.  
It runs locally, authenticates with OAuth, and maps each QBO entity to an MCP tool so Claude can fetch data with zero boilerplate.

## 2. Goals
1. **Query with natural language** – Claude+MCP should return QBO data in seconds.  
2. **Zero manual API keys** – OAuth 2.0 click-through flow, tokens persisted locally.  
3. **One tool per QBO object** – Customers, Invoices, Payments, Reports, etc.  
4. **Lean & DRY** – < 200 LOC, no custom MCP plumbing, no database.  
5. **Proof-of-concept ready** – Runs on Node 18+, offline except for QBO API calls.

## 3. User Stories
- **As an accountant**, I type “Show paid invoices last month” and receive a table with links to each invoice.  
- **As a firm manager**, I ask “Total revenue YTD for ACME LLC” and get the Profit & Loss summary instantly.  
- **As a bookkeeper**, I query “List new customers since 2025-01-01” and receive contact info with direct QBO links.  

## 4. Functional Requirements
1. **OAuth Flow**  
   1.1 Generate an authorization URL for the user.  
   1.2 Handle callback, exchange code for tokens, save `tokens.json`.  
   1.3 Auto-refresh access tokens (100-day refresh token).  
2. **MCP Server**  
   2.1 Expose tools via FastMCP HTTP transport.  
   2.2 Provide `/health_check` tool returning **OK**.  
3. **Tool Factory**  
   3.1 For each entity in `entities.ts`, register `qb.list_<entity>s` (read-only).  
   3.2 Accept parameters `{startDate, endDate, limit}` validated by Zod.  
   3.3 Execute corresponding `node-quickbooks` SDK call and return JSON string.  
4. **Report Tool**  
   4.1 `qb.report_pnl` returns Profit & Loss for a date range.  
5. **Error Handling** – Return human-friendly errors for missing tokens, 401, or 429.  
6. **Output Formatting** – Claude (LLM) handles display; server returns JSON or plaintext.

## 5. Non-Goals (Out of Scope)
- Creating or modifying QBO data (read-only only).  
- QuickBooks Desktop support.  
- Production-grade logging, metrics, or rate-limit backoff logic.  
- UI beyond Claude chat (no web dashboards).  

## 6. Design Considerations
- **Framework**: FastMCP to avoid hand-rolled manifests.  
- **SDKs**: `node-quickbooks` and `intuit-oauth` to stay DRY.  
- **Token storage**: flat file (`tokens.json`) for simplicity; delete to reset.  
- **Security**: localhost-only server; plaintext tokens acceptable for POC.  

## 7. Technical Considerations
- **Node 18+** (built-in `fetch`, top-level await).  
- **TypeScript via `tsx`** for instant execution without build step.  
- **Testing**: Vitest + PollyJS fixtures recorded from QBO sandbox.  
- **Environment**: `.env` with `INTUIT_CLIENT_ID`, `INTUIT_CLIENT_SECRET`, `PORT`.

## 8. Success Metrics
- **Time-to-answer** ⟂ ＜ 5 sec for a basic query on a sandbox company.  
- **Setup friction** ⟂ Developer can clone, `npm start`, and connect QBO in ≤ 10 min.  
- **Code footprint** ⟂ ≤ 200 executable LOC (excluding tests & deps).  

## 9. Open Questions
1. Should we pre-populate sandbox data or rely on Intuit’s default demo company?  
2. Will we need fuzzy-matching (Fuse.js) for vendor name variants in phase 1?  
3. Do we expose raw JSON only, or a minimal Markdown table for lists?  
4. How should we handle multiple connected companies in the initial UI flow?

