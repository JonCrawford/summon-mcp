# Claude Desktop Setup - Quick Guide

## Step 1: Open Claude Desktop Config

On Mac:
1. Open Claude Desktop
2. Click on "Claude" in the menu bar
3. Select "Settings" (or press `Cmd + ,`)
4. Click on "Developer" tab
5. Click "Edit Config"

This opens: `~/Library/Application Support/Claude/claude_desktop_config.json`

## Step 2: Add QuickBooks MCP Server

Add this to your config file:

```json
{
  "mcpServers": {
    "quickbooks": {
      "command": "npx",
      "args": ["tsx", "src/server.ts"],
      "cwd": "/Users/jon/Projects/quickbooks-mcp2",
      "env": {
        "INTUIT_CLIENT_ID": "your_client_id",
        "INTUIT_CLIENT_SECRET": "your_client_secret",
        "QUICKBOOKS_PRODUCTION": "false"
      }
    }
  }
}
```

If you already have other servers, add it like this:

```json
{
  "mcpServers": {
    "filesystem": {
      // ... existing filesystem config
    },
    "quickbooks": {
      "command": "npx",
      "args": ["tsx", "src/server.ts"],
      "cwd": "/Users/jon/Projects/quickbooks-mcp2",
      "env": {
        "INTUIT_CLIENT_ID": "your_client_id",
        "INTUIT_CLIENT_SECRET": "your_client_secret",
        "QUICKBOOKS_PRODUCTION": "false"
      }
    }
  }
}
```

## Step 3: Save and Restart

1. Save the config file
2. **Completely quit Claude Desktop** (Cmd + Q)
3. Start Claude Desktop again

## Step 4: Verify It's Working

In a new Claude conversation, try:
- "Use the health_check tool"
- "List QuickBooks customers"
- "Show me recent invoices"

## Troubleshooting

If it's not working:

1. **Check the MCP icon** - It should show in the Claude interface
2. **Check logs**: Developer → Logs
3. **Verify tokens exist**:
   ```bash
   ls -la /Users/jon/Projects/quickbooks-mcp2/tokens.json
   ```
4. **Test manually**:
   ```bash
   cd /Users/jon/Projects/quickbooks-mcp2
   npx tsx src/server.ts --stdio
   ```
   (Should wait for input, press Ctrl+C to exit)

## Common Issues

- **No MCP icon**: Config not loaded - check JSON syntax
- **Tools not found**: Server didn't start - check logs
- **Auth errors**: tokens.json missing or expired - run `npm run refresh-tokens`

## Production Mode

To use production mode (connects to live QuickBooks data):

1. Change `QUICKBOOKS_PRODUCTION` to `"true"` in the config
2. Restart Claude Desktop
3. Authenticate with your production QuickBooks account

Note: Production mode uses `tokens.json` while sandbox mode uses `tokens_sandbox.json`, allowing you to maintain separate authentications.