# Intuit App Settings Update Guide

## Task 1.3: Add Production Redirect URI

This guide documents the steps needed to update your Intuit app settings to support the production OAuth redirect URI using sslip.io.

## Required Update

Add the following redirect URI to your Intuit app:
```
https://127-0-0-1.sslip.io/cb
```

## Why sslip.io?

- **Problem**: Intuit requires HTTPS for production OAuth callbacks, but local development uses HTTP
- **Solution**: sslip.io provides a DNS service that maps `127-0-0-1.sslip.io` to `127.0.0.1`
- **Benefit**: Allows HTTPS callbacks to reach your local development server

## Steps to Update

### 1. Log into Intuit Developer Dashboard
1. Navigate to https://developer.intuit.com
2. Sign in with your developer account
3. Go to "My Apps" section

### 2. Select Your QuickBooks App
1. Find your QuickBooks MCP application
2. Click on the app name to open settings

### 3. Navigate to OAuth Settings
1. Look for "Keys & OAuth" or "Keys & credentials" section
2. You should see existing redirect URIs listed

### 4. Add Production Redirect URI
1. Look for "Redirect URIs" section
2. Click "Add URI" or similar button
3. Enter: `https://127-0-0-1.sslip.io/cb`
4. Save the changes

### 5. Verify Existing URIs
Ensure you also have the sandbox URI:
```
http://localhost:8080/cb
```

The port may vary based on your configuration. Common ports:
- 8080 (default)
- 3000
- Dynamic port (for production use)

### 6. Environment-Specific URIs

Your app should now have at least these redirect URIs:
- **Sandbox**: `http://localhost:{port}/cb`
- **Production**: `https://127-0-0-1.sslip.io/cb`

## Testing the Configuration

After updating, you can verify the URI works:

```bash
# Test DNS resolution
nslookup 127-0-0-1.sslip.io
# Should return 127.0.0.1

# Test with curl (will fail without server running, but confirms DNS)
curl https://127-0-0-1.sslip.io/cb
```

## Notes

1. **No Certificate Required**: The sslip.io domain has a valid wildcard SSL certificate
2. **Port Flexibility**: The production URI doesn't specify a port, allowing dynamic port selection
3. **Local Only**: This URI only works for local development, not for deployed servers
4. **Security**: The HTTPS requirement is enforced by Intuit for production apps

## Next Steps

After updating the Intuit app settings:
1. Document the change in your README
2. Update environment configuration to use the correct URI based on mode
3. Test OAuth flow with both sandbox and production settings