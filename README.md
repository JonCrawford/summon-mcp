# summon - QuickBooks MCP Server

A Model Context Protocol (MCP) server that provides read-only access to QuickBooks Online data with multi-company support.

## Architecture: Direct OAuth vs Token Broker

This project supports two architectures:

1. **Direct OAuth** (`src/server.ts`) - For local development with Claude Desktop config
2. **Token Broker** (`src/server-broker.ts`) - For DXT packaging (required for Claude Desktop Extensions)

⚠️ **Important**: When packaging as a DXT, you MUST use the broker architecture. The direct OAuth server will crash on startup because DXT processes cannot run web servers.

## Setup

1. Install dependencies:

    ```bash
    npm install
    ```

2. Configure environment variables:

    - Copy `.env.example` to `.env`
    - Add your QuickBooks OAuth credentials
    - Set `QUICKBOOKS_PRODUCTION=true` for production mode (defaults to sandbox)

3. Authenticate with QuickBooks:
    - Run `npm start`
    - Visit `http://localhost:8080/connect`
    - Or use existing refresh token: `npm run refresh-tokens`

## Adding to Claude Desktop

1. Make sure you have valid tokens:

    ```bash
    npm run refresh-tokens  # If you have a refresh token
    # OR
    npm start  # Then visit http://localhost:8080/connect
    ```

2. Open Claude Desktop settings (Developer → Edit Config)

3. Add the MCP server configuration:

    ```json
    {
        "mcpServers": {
            "summon": {
                "command": "npx",
                "args": ["tsx", "src/server.ts"],
                "cwd": "/Users/jon/Projects/quickbooks-mcp2",
                "env": {
                    "QB_CLIENT_ID": "your_client_id",
                    "QB_CLIENT_SECRET": "your_client_secret",
                    "QB_STORAGE_DIR": "/Users/yourusername/.summon"
                }
            }
        }
    }
    ```

4. Restart Claude Desktop

The server will automatically detect it's being run by Claude Desktop and use stdio transport.

## Available Tools

Once connected, you'll have access to:

### Management Tools

-   `health_check` - Check server status and connection
-   `authenticate` - Connect to a QuickBooks company
-   `clear_auth` - Disconnect from QuickBooks
-   `qb_list_companies` - List all connected companies

### Entity Tools

-   `qb_list_customers` - List QuickBooks customers
-   `qb_list_invoices` - List QuickBooks invoices
-   `qb_list_payments` - List QuickBooks payments
-   `qb_list_vendors` - List QuickBooks vendors
-   `qb_list_items` - List QuickBooks items
-   `qb_list_accounts` - List chart of accounts
-   `qb_list_bills` - List QuickBooks bills
-   `qb_list_estimates` - List QuickBooks estimates
-   `qb_list_employees` - List QuickBooks employees
-   `qb_list_transactions` - List transactions (purchases)

### Report Tool

-   `qb_report` - Generate various reports with parameters:
    -   `reportType`: profit_and_loss, balance_sheet, cash_flow, customer_sales, etc.
    -   `startDate`: Start date (ISO format)
    -   `endDate`: End date (ISO format)
    -   `summarizeBy`: Total, Month, Week, Days (optional)
    -   `accountingMethod`: Cash, Accrual (optional)

### Utility Tools

-   `health_check` - Check server status

## Example Usage in Claude

Once connected, you can ask Claude things like:

-   "Show me all customers"
-   "List invoices from last month"
-   "Generate a P&L report for Q4 2023"
-   "Show me unpaid bills"

## Token Management

-   Tokens are stored in `tokens.json` (production) or `tokens_sandbox.json` (sandbox)
-   Access tokens expire after 1 hour (auto-refreshed)
-   Refresh tokens expire after 100 days
-   To manually refresh: `npm run refresh-tokens`

## Production vs Sandbox Mode

The server operates in sandbox mode by default for safety. To use production mode:

1. Set the environment variable: `QB_PRODUCTION=true`
2. Authenticate with QuickBooks production account
3. Tokens will be saved to SQLite database in the storage directory

Note: You can maintain separate authentication for both environments. All tokens are stored in a single SQLite database with environment isolation.

### Important: DXT Mode Configuration

When running in Claude Desktop (DXT mode), you MUST pass the OAuth credentials as environment variables in your Claude Desktop configuration. Without these, the server will show "0 companies" even if tokens are saved. Example configuration:

```json
{
  "summon": {
    "command": "npx",
    "args": ["tsx", "/path/to/server.ts"],
    "env": {
      "QB_CLIENT_ID": "your_client_id",
      "QB_CLIENT_SECRET": "your_client_secret",
      "QB_PRODUCTION": "true",
      "QB_STORAGE_DIR": "/Users/yourname/Documents"
    }
  }
}
```

## Token Storage & Multi-Company Support

summon uses SQLite for secure token storage with multi-company support:

-   **Storage Location**: By default, tokens are stored in `~/.summon/tokens.db`
-   **Multi-Company**: Multiple QuickBooks companies can be connected simultaneously
-   **Company Mapping**: The LLM can reference companies by name (e.g., "the roofers" for "XYZ Roofing Company")
-   **Migration**: Run `npm run migrate` to migrate existing JSON token files to SQLite

### Storage Directory Configuration

-   **Local Development**: Set `QB_STORAGE_DIR` environment variable
-   **DXT Package**: Configure `storage_directory` in Claude Desktop settings
-   **Default**: `~/.summon` (created automatically)

### Managing Companies

-   List connected companies: Use the `qb_list_companies` tool
-   Authenticate new company: Use the `authenticate` tool
-   Clear specific company: Use the `clear_auth` tool with company name/ID
-   Clear all companies: Use the `clear_auth` tool without parameters

## Development

-   `npm run dev` - Start with auto-reload
-   `npm test` - Run tests
-   `npm run lint` - Run linter
-   `npm run typecheck` - Type check

## Building DXT Package

```bash
# Build and package as DXT (uses broker architecture)
npm run build:dxt

# This creates quickbooks-mcp.dxt using manifest-broker.json
# The package uses server-broker.js which requires external token broker
```
