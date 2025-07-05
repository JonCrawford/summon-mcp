# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a QuickBooks MCP (Model Context Protocol) Server that provides read-only access to QuickBooks Online data via natural language queries. The server runs locally, uses OAuth 2.0 for authentication, and exposes one MCP tool per QuickBooks entity.

**Current Status**: Fully implemented and functional. OAuth authentication working, all tools implemented, tests passing.

## Important Memories

- It's important to adhere to the MCP spec where only valid JSON is emitted in MCP responses. Clients expect only valid JSON and will error without it.
- Fixed "Method not found" errors for `resources/list` and `prompts/list` endpoints by adding minimal resource and prompt to the server. FastMCP only sets up these handlers if resources/prompts are registered, so we added a server info resource and help prompt to ensure the endpoints are available.
- Server operates in sandbox mode by default. Set `QUICKBOOKS_PRODUCTION=true` to use production mode.
- Token files are isolated: `tokens.json` for production, `tokens_sandbox.json` for sandbox.

## Development Commands

### Initial Setup
```bash
# Initialize project
npm init -y

# Install runtime dependencies
npm install fastmcp dotenv intuit-oauth node-quickbooks zod

# Install dev dependencies
npm install -D typescript tsx @types/node vitest @pollyjs/core @pollyjs/adapter-node-http @pollyjs/persister-fs eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin

# Create environment file from template
cp .env.example .env
# Then add your INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET
```

### Common Commands
```bash
# Start the MCP server
npm start

# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint

# Run specific test
npx vitest run oauth.test.ts

# Regenerate HTTP fixtures for tests
VCR_MODE=record npm test
```

## Architecture

### Core Components

1. **FastMCP Server** (`src/server.ts`)
   - HTTP transport on configurable port (default 8080)
   - Exposes MCP tools for QuickBooks entities
   - Health check endpoint for verification

2. **OAuth Handler** (`src/quickbooks.ts`)
   - Manages OAuth 2.0 flow with Intuit
   - Persists tokens to `tokens.json`
   - Auto-refreshes expired access tokens
   - Provides authenticated QuickBooks client

3. **Tool Factory** (`src/tools/index.ts`)
   - Dynamically generates one tool per QuickBooks entity
   - Maps entities from `src/tools/entities.ts` to SDK functions
   - Standard parameters: `startDate`, `endDate`, `limit`
   - Returns JSON stringified results

4. **Entity Mappings** (`src/tools/entities.ts`)
   - Central configuration of QBO entities (Customer, Invoice, Payment, etc.)
   - Maps entity names to node-quickbooks SDK function names

### Testing Strategy

- **Framework**: Vitest with TypeScript support via tsx
- **HTTP Mocking**: PollyJS for recording/replaying QuickBooks API calls
- **Test Structure**:
  - `tests/oauth.test.ts` - OAuth flow and token persistence
  - `tests/tools.test.ts` - Entity tool functionality with fixtures
  - `tests/health.test.ts` - Health check endpoint
- **Fixtures**: Stored in `polly/fixtures/` for consistent offline testing

### Key Design Decisions

1. **Lean Implementation**: Target < 200 LOC for proof of concept
2. **No Build Step**: Uses tsx for direct TypeScript execution
3. **Simple Token Storage**: Flat files with environment isolation
   - `tokens.json` for production mode
   - `tokens_sandbox.json` for sandbox mode (default)
4. **Read-Only Access**: No create/update/delete operations
5. **Tool Naming**: `qb_list_<entity>s` pattern (e.g., `qb_list_customers`)
6. **Safe Defaults**: Sandbox mode by default, explicit opt-in for production

## MCP Tool Structure

Each generated tool follows this pattern:
- **Name**: `qb_list_<entity>s` (e.g., `qb_list_invoices`)
- **Parameters** (Zod validated):
  - `startDate` (optional): ISO date string
  - `endDate` (optional): ISO date string
  - `limit` (optional): Number, default 20
- **Returns**: JSON string of QuickBooks data

Special tools:
- `health_check`: Returns "OK" to verify server status
- `qb_report`: Unified report tool for various QuickBooks reports

Additional MCP capabilities:
- **Resource**: `Server Info` - Provides information about the QuickBooks MCP server
- **Prompt**: `quickbooks-query-help` - Help with QuickBooks queries and available tools

## OAuth Flow

1. User navigates to `/connect` endpoint
2. Server generates Intuit authorization URL
3. User authorizes and is redirected to `/callback`
4. Server exchanges code for tokens and saves to `tokens.json`
5. Subsequent API calls use these tokens (auto-refresh as needed)

## Environment Variables

Required in `.env`:
```
INTUIT_CLIENT_ID=your_client_id
INTUIT_CLIENT_SECRET=your_client_secret
PORT=8080  # Optional, defaults to 8080
QUICKBOOKS_PRODUCTION=true  # Optional, defaults to false (sandbox mode)
```

## Error Handling

- Missing tokens: Prompt user to connect via OAuth flow
- 401 Unauthorized: Attempt token refresh, re-authenticate if needed
- 429 Rate Limit: Return user-friendly error (no retry logic in POC)
- All errors return human-readable messages for Claude to relay

## Development Workflow

1. Ensure OAuth credentials are configured in `.env`
2. Start server with `npm run dev` for auto-reload during development
3. Connect QuickBooks account via `/connect` endpoint
4. Test tools via Claude Desktop or direct MCP client
5. Run tests frequently with `npm test`
6. Use recorded fixtures to test without hitting live API