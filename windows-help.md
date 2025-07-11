# Windows OAuth Debugging Guide

## Finding Logs on Windows

The logs appear in the console where you run the MCP server. Since you mentioned you can't find the logs, here are the steps:

### 1. If running through Claude Desktop

The logs should appear in Claude Desktop's logs. Location varies by version:
- Check `%APPDATA%\Claude\logs\` 
- Or `%LOCALAPPDATA%\Claude\logs\`

### 2. If running manually for testing

Open Command Prompt or PowerShell and run:

```cmd
cd path\to\summon-quickbooks-mcp
set QB_PRODUCTION=true
set QB_CLIENT_ID=ABRlxZcZnmwYNGFoi1MopMid2ac7sgAm6UNN8D46dxQb5yKch8
set QB_CLIENT_SECRET=BIZNbkZ8B8kwWxGl3SX8Cwr0t0osNRSgO0pw5mxx
npx tsx src/server.ts > oauth-debug.log 2>&1
```

This will save all output to `oauth-debug.log`.

### 3. Run the debug script

```cmd
node debug-oauth-windows.js > debug-output.txt 2>&1
```

### 4. Check which port is being used

Before running the authenticate command:
```cmd
netstat -ano | findstr :9741
netstat -ano | findstr :9742
netstat -ano | findstr :9743
```

### 5. What to look for in the logs

Look for these key lines:
- `OAuth: Listener started on port XXXX` - This shows which port was actually used
- `OAuth: CRITICAL - Listener port: XXXX, Redirect URI: YYYY` - This confirms the port/URI match
- `OAuth: URL Components:` - This shows if the scope is present
- `TokenManager.generateAuthUrl: WARNING` - Indicates scope issues

### 6. Manual OAuth Test

If the MCP authenticate tool isn't working, try this manual test:

1. Start just the OAuth listener:
```cmd
node -e "import('./src/oauth-listener.js').then(m => new m.OAuthListener().start().then(({port}) => console.log('Listening on port', port)))"
```

2. Note the port it says it's listening on

3. Open this URL in your browser (replace PORT with actual port):
```
https://appcenter.intuit.com/connect/oauth2?response_type=code&client_id=ABRlxZcZnmwYNGFoi1MopMid2ac7sgAm6UNN8D46dxQb5yKch8&redirect_uri=https%3A%2F%2F127-0-0-1.sslip.io%3APORT%2Fcb&scope=com.intuit.quickbooks.accounting&state=test123
```

## Common Windows Issues

1. **Windows Defender Firewall** - May block the OAuth callback. Check firewall settings.

2. **Corporate Proxy** - If on a corporate network, proxy settings might interfere.

3. **WSL2/Hyper-V** - These often use ports in the 9000-10000 range.

4. **Browser Issues** - Edge might have stricter security. Try Chrome or Firefox.

## Send Us This Info

Please run the debug script and send us:
1. The output from `debug-oauth-windows.js`
2. The console output when you try to authenticate
3. Which browser opens when you click authenticate
4. The exact URL shown in the browser when you get the error