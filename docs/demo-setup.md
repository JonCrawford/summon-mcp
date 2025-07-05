# QuickBooks MCP Demo Setup Guide

This guide helps you quickly set up the QuickBooks MCP server with a mock token broker for demonstrations.

## Quick Start for Demo

### 1. Edit Mock Data

Edit `src/mock-token-broker.ts` and update the following with your actual data:

```typescript
// Replace these with your actual company details
const MOCK_COMPANIES: Company[] = [
  {
    id: 'company-1',
    name: 'Your Company Name',        // <- Change this
    realmId: 'YOUR_REALM_ID',        // <- Change this
    createdAt: '2024-01-01T00:00:00Z',
    lastAccessed: new Date().toISOString()
  },
  // Add more companies as needed
];

// Replace with your actual refresh tokens
const MOCK_TOKENS: Record<string, QuickBooksToken> = {
  'company-1': {
    access_token: 'will-be-refreshed',
    refresh_token: 'YOUR_ACTUAL_REFRESH_TOKEN',  // <- Change this
    realm_id: 'YOUR_REALM_ID',                   // <- Change this
    company_name: 'Your Company Name',           // <- Change this
    expires_at: Date.now() + 3600000
  },
  // Add more tokens as needed
};
```

### 2. Start the Mock Token Broker

In terminal 1:
```bash
npm run start:mock-broker
```

This will start a mock token broker on http://localhost:3000

### 3. Configure Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "quickbooks": {
      "command": "node",
      "args": ["/path/to/quickbooks-mcp2/dist/server-broker.js"],
      "env": {
        "brokerApiUrl": "http://localhost:3000",
        "brokerApiToken": "demo-token-123",
        "enableDebugLogging": "true"
      }
    }
  }
}
```

### 4. Build and Test

```bash
# Build the project
npm run build

# Package as DXT (optional)
npm run package:dxt
```

### 5. Demo Commands

Once set up, you can use these commands in Claude:

- **List companies**: "Show me all connected QuickBooks companies"
- **Get invoices**: "Show me Acme Corporation's recent invoices"
- **Financial report**: "Generate a P&L report for Widget Industries"
- **Cache stats**: "Show me the cache performance metrics"

## Getting Real Refresh Tokens

To get actual refresh tokens for your demo:

1. Use the legacy OAuth server:
   ```bash
   npm start
   ```

2. Navigate to http://localhost:8080/connect

3. Authorize with QuickBooks

4. Check the `tokens.json` or `tokens_sandbox.json` file for the refresh token

5. Copy the refresh token to your mock broker configuration

## Security Note

⚠️ **For demos only!** The mock broker stores tokens in plain text. For production:
- Use the real token broker with proper encryption
- Never commit real tokens to source control
- Use environment variables for sensitive data

## Troubleshooting

### Mock broker not responding
- Check if port 3000 is available
- Use `MOCK_BROKER_PORT=3001 npm run start:mock-broker` to change port

### Authentication errors
- Verify the `brokerApiToken` matches between mock broker and Claude config
- Check that refresh tokens are valid and not expired

### Company not found
- Ensure company names match exactly (case-sensitive)
- Try using company ID or realm ID instead

## Demo Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Claude Desktop  │────▶│ QuickBooks MCP   │────▶│  Mock Token     │
│                 │     │   (DXT)          │     │  Broker         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                           │
                                ▼                           ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Local Cache     │     │ Hardcoded       │
                        │  (24hr TTL)      │     │ Tokens          │
                        └──────────────────┘     └─────────────────┘
```

The mock broker simulates the real token broker API but uses hardcoded tokens instead of a database.