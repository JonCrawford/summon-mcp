# QuickBooks MCP DXT OAuth Guide

## Overview

DXT (Desktop Extensions) run in a read-only file system environment, which prevents the QuickBooks MCP server from saving OAuth tokens to disk. This guide explains how to authenticate with QuickBooks when using the DXT version.

## The Challenge

In a standard installation, the QuickBooks MCP server:
1. Runs an OAuth flow that opens your browser
2. Exchanges authorization codes for tokens
3. **Saves tokens to `tokens.json` file**
4. Automatically refreshes tokens as needed

In DXT environments:
- ❌ Cannot write to file system (EROFS: read-only file system)
- ❌ Cannot save tokens to disk
- ✅ Can read tokens from environment variables
- ✅ Can refresh access tokens in memory

## Solution: Pre-Authentication

Since DXT can't save tokens, you need to authenticate locally first and then provide the tokens to DXT.

### Step 1: Authenticate Locally

1. Clone this repository locally:
   ```bash
   git clone https://github.com/your-org/quickbooks-mcp.git
   cd quickbooks-mcp
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Set up your OAuth credentials:
   ```bash
   export QB_CLIENT_ID="your-client-id"
   export QB_CLIENT_SECRET="your-client-secret"
   ```

4. Run the authentication flow:
   ```bash
   node dist/server.js
   ```

5. Use the `authenticate` tool to start OAuth flow
   - Your browser will open
   - Authorize the QuickBooks connection
   - **The refresh token will be displayed in the response**
   - Tokens will also be saved to `tokens.json` or `tokens_sandbox.json`

### Step 2: Copy the Refresh Token

After successful authentication, the MCP server will display:
- The refresh token you need for DXT configuration
- The Realm ID (company identifier)
- Instructions for configuring your MCP client

**Alternative method** - Extract from saved file:
```bash
# For sandbox mode (default)
cat tokens_sandbox.json | jq -r '."Default Company".refreshToken'

# For production mode
cat tokens.json | jq -r '."Default Company".refreshToken'
```

### Step 3: Configure DXT

1. Install the DXT extension in Claude Desktop
2. Open Claude Desktop settings
3. Find the QuickBooks MCP configuration
4. Enter your credentials:
   - **QuickBooks Client ID**: Your OAuth app client ID
   - **QuickBooks Client Secret**: Your OAuth app client secret
   - **QuickBooks Refresh Token**: The token from Step 2
   - **Production Mode**: Toggle based on your environment

## How It Works

1. **Initial Load**: DXT reads the refresh token from configuration
2. **First API Call**: Server uses refresh token to get a new access token
3. **In-Memory Storage**: Access token is kept in memory for the session
4. **Auto-Refresh**: When access token expires, it's refreshed automatically
5. **Session End**: Tokens are lost when server stops (but refresh token remains in config)

## Token Expiration

- **Access tokens**: Expire after 1 hour (auto-refreshed)
- **Refresh tokens**: Expire after 100 days of inactivity

If your refresh token expires:
1. Re-authenticate locally (Step 1)
2. Update the refresh token in DXT config (Step 3)

## Troubleshooting

### "EROFS: read-only file system" Error
This is expected in DXT. The server will use environment variables instead.

### "Authentication failed" After Configuration
- Verify your refresh token is correct (no extra spaces/quotes)
- Check if you're using the right environment (sandbox vs production)
- Ensure your OAuth app is active in Intuit Developer portal

### "Token expired" Messages
If you see this repeatedly:
1. Your refresh token may have expired (>100 days unused)
2. Re-authenticate locally to get a new refresh token

## Future Improvements

When DXT adds the `dxt.saveConfig()` API, this server will automatically:
- Save new refresh tokens when they're rotated
- Eliminate the need for manual token management
- Provide a seamless OAuth experience

The code already includes feature detection for this future capability.

## Security Notes

- Refresh tokens are sensitive - treat them like passwords
- Only share tokens through secure channels
- Revoke unused tokens in QuickBooks dashboard
- Use sandbox mode for testing/development