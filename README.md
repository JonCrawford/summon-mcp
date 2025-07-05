# QuickBooks MCP Server

A Model Context Protocol (MCP) server that provides read-only access to QuickBooks Online data.

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
       "quickbooks": {
         "command": "npx",
         "args": ["tsx", "src/server.ts"],
         "cwd": "/Users/jon/Projects/quickbooks-mcp2"
       }
     }
   }
   ```

4. Restart Claude Desktop

The server will automatically detect it's being run by Claude Desktop and use stdio transport.

## Available Tools

Once connected, you'll have access to:

### Entity Tools
- `qb.list_customers` - List QuickBooks customers
- `qb.list_invoices` - List QuickBooks invoices
- `qb.list_payments` - List QuickBooks payments
- `qb.list_vendors` - List QuickBooks vendors
- `qb.list_items` - List QuickBooks items
- `qb.list_accounts` - List chart of accounts
- `qb.list_bills` - List QuickBooks bills
- `qb.list_estimates` - List QuickBooks estimates
- `qb.list_employees` - List QuickBooks employees
- `qb.list_transactions` - List transactions (purchases)

### Report Tool
- `qb.report` - Generate various reports with parameters:
  - `reportType`: profit_and_loss, balance_sheet, cash_flow, customer_sales, etc.
  - `startDate`: Start date (ISO format)
  - `endDate`: End date (ISO format)
  - `summarizeBy`: Total, Month, Week, Days (optional)
  - `accountingMethod`: Cash, Accrual (optional)

### Utility Tools
- `health_check` - Check server status

## Example Usage in Claude

Once connected, you can ask Claude things like:
- "Show me all customers"
- "List invoices from last month"
- "Generate a P&L report for Q4 2023"
- "Show me unpaid bills"

## Token Management

- Tokens are stored in `tokens.json` (production) or `tokens_sandbox.json` (sandbox)
- Access tokens expire after 1 hour (auto-refreshed)
- Refresh tokens expire after 100 days
- To manually refresh: `npm run refresh-tokens`

## Production vs Sandbox Mode

The server operates in sandbox mode by default for safety. To use production mode:

1. Set the environment variable: `QUICKBOOKS_PRODUCTION=true`
2. Authenticate with QuickBooks production account
3. Tokens will be saved to `tokens.json` (production) instead of `tokens_sandbox.json` (sandbox)

Note: You can maintain separate authentication for both environments.

## Development

- `npm run dev` - Start with auto-reload
- `npm test` - Run tests
- `npm run lint` - Run linter
- `npm run typecheck` - Type check