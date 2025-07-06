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
- **DXT Packaging**: MUST use `server-broker.ts` and `manifest-broker.json`. The direct OAuth server (`server.ts`) will crash in DXT because it tries to instantiate OAuth client at startup.
- **MCP Protocol Compliance**: Server MUST NOT call `process.exit(1)` before completing the MCP handshake. The server must always be able to start and respond to the initialize request, even when unconfigured. Report configuration issues through the protocol (health_check tool, error responses) instead of exiting during startup.
- **Async File Operations**: All file I/O (logger, cache) must use async operations with `setImmediate()` to avoid blocking startup in read-only DXT environment. Synchronous fs operations will crash the extension.

## Development Commands

### Initial Setup
```bash
# Install DXT CLI globally
npm install -g @anthropic-ai/dxt

# Install dependencies
npm install

# Create environment file from template
cp .env.example .env
# Then add your INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET
```

### Common Commands
```bash
# Build TypeScript
npm run build

# Package as DXT (use native CLI, not custom scripts)
dxt pack . quickbooks-mcp.dxt

# Validate manifest
dxt validate manifest.json

# Run tests
npm test

# Run linter
npm run lint
```

## Architecture

### Two Server Implementations

**Critical**: Choose the right server based on your deployment target:

1. **Direct OAuth Server** (`src/server.ts`) - Local development only
   - Instantiates OAuth client on startup
   - Runs web server for OAuth callbacks
   - Used by `manifest.json` and `manifest-simple.json`
   - **Will crash if packaged as DXT**

2. **Token Broker Server** (`src/server-broker.ts`) - For DXT packaging
   - No OAuth client instantiation
   - Pure stdio transport
   - Used by `manifest-broker.json`
   - Required for Claude Desktop Extensions

### Core Components

1. **OAuth Handler** (`src/quickbooks.ts`)
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

## MCP Inspector CLI Usage

### Basic Usage
- Basic CLI invocation:
  ```
  npx @modelcontextprotocol/inspector --cli node build/index.js
  ```

### Configuration and Server Options
- Run with config file:
  ```
  npx @modelcontextprotocol/inspector --cli --config path/to/config.json --server myserver
  ```

### Tool and Resource Management
- List available tools:
  ```
  npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/list
  ```
- Call a specific tool:
  ```
  npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/call --tool-name mytool --tool-arg key=value --tool-arg another=value2
  ```
- List available resources:
  ```
  npx @modelcontextprotocol/inspector --cli node build/index.js --method resources/list
  ```
- List available prompts:
  ```
  npx @modelcontextprotocol/inspector --cli node build/index.js --method prompts/list
  ```

### Remote Server Connections
- Connect to remote MCP server (default SSE transport):
  ```
  npx @modelcontextprotocol/inspector --cli https://my-mcp-server.example.com
  ```
- Connect with Streamable HTTP transport:
  ```
  npx @modelcontextprotocol/inspector --cli https://my-mcp-server.example.com --transport http
  ```
- Call tool on remote server:
  ```
  npx @modelcontextprotocol/inspector --cli https://my-mcp-server.example.com --method tools/call --tool-name remotetool --tool-arg param=value
  ```
- List resources from remote server:
  ```
  npx @modelcontextprotocol/inspector --cli https://my-mcp-server.example.com --method resources/list
  ```