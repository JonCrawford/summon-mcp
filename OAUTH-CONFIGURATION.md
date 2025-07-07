# OAuth Configuration Guide

## Important: Fixed Redirect URIs

This QuickBooks MCP server uses **fixed redirect URIs** that must be configured exactly in your Intuit app settings.

### Redirect URIs

**Production Mode:**
```
https://127-0-0-1.sslip.io:9741/cb
```

**Sandbox/Development Mode:**
```
http://localhost:9741/cb
```

### Port Configuration

The OAuth callback server **always** runs on port **9741**. This is hardcoded and cannot be changed without updating:
1. Your Intuit app's redirect URI configuration
2. The `OAUTH_CALLBACK_PORT` constant in `src/oauth-listener.ts`
3. All redirect URI references in the codebase

### Intuit App Configuration

1. Log into https://developer.intuit.com
2. Go to your app's settings
3. Add the appropriate redirect URI based on your environment:
   - For sandbox apps: Add `http://localhost:9741/cb`
   - For production apps: Add `https://127-0-0-1.sslip.io:9741/cb`

### Why sslip.io?

- Intuit requires HTTPS for production OAuth callbacks
- `127-0-0-1.sslip.io` resolves to `127.0.0.1` (localhost) with a valid SSL certificate
- This allows HTTPS callbacks to localhost without certificate warnings

### Environment Configuration

Set in your `.env` file:
```bash
# For production mode (uses https://127-0-0-1.sslip.io:9741/cb)
QUICKBOOKS_PRODUCTION=true

# For sandbox mode (uses http://localhost:9741/cb)
QUICKBOOKS_PRODUCTION=false
```

### OAuth Flow

1. User calls the `authenticate` tool
2. Server starts OAuth listener on port 9741
3. Browser opens to Intuit authorization URL
4. User authorizes the app
5. Intuit redirects to the configured callback URL
6. OAuth listener captures the code and exchanges it for tokens
7. Tokens are stored securely for future API calls

### Troubleshooting

**404 Error on Callback:**
- Ensure the OAuth listener is still running (it has a timeout)
- Verify port 9741 is not blocked by firewall or other services
- Check that the redirect URI in Intuit matches exactly

**Connection Refused:**
- The OAuth listener may have timed out
- Try the authentication flow again
- Ensure no other service is using port 9741

**Invalid Grant Error:**
- The authorization code may have expired (they're only valid for a few minutes)
- Start the authentication flow again

### Security Notes

- The OAuth listener only runs during the authentication flow
- It automatically shuts down after receiving the callback or timing out
- Authorization codes are single-use and expire quickly
- Refresh tokens are stored securely and used for subsequent API calls