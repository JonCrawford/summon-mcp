# Sandbox Redirect URI Verification

## Task 1.4: Verify Existing Sandbox Redirect URI

### Current Configuration

After investigating the codebase:

1. **Hardcoded Redirect URI**: Found in `src/quickbooks.ts:62`
   ```typescript
   redirectUri: 'http://localhost:3000/callback',
   ```

2. **Port Mismatch**: 
   - The QuickBooks OAuth client is configured to use port 3000
   - README mentions port 8080 for OAuth flow: "Visit `http://localhost:8080/connect`"
   - Environment example shows `PORT=8080` and `MCP_PORT=3000`

3. **No OAuth Server Implementation Found**:
   - The current `src/server.ts` is an MCP server with stdio transport
   - No Express/HTTP server implementation for OAuth callbacks
   - No `/connect` or `/callback` routes implemented

### Expected Sandbox Redirect URIs

Based on the investigation, the app should have these redirect URIs configured in Intuit:

1. **Current hardcoded**: `http://localhost:3000/callback`
2. **Per README**: `http://localhost:8080/cb` or `http://localhost:8080/callback`
3. **Dynamic port support**: `http://localhost:{port}/cb` (for future flexibility)

### Issues Identified

1. **Missing OAuth Server**: The OAuth flow mentioned in README (`npm start` then visit `/connect`) doesn't exist in the current implementation
2. **Port Confusion**: Multiple ports referenced (3000, 8080) without clear purpose
3. **Path Inconsistency**: `/callback` vs `/cb` endpoints

### Recommended Actions

1. **Verify in Intuit Dashboard** that these URIs are registered:
   - `http://localhost:3000/callback` (current code)
   - `http://localhost:8080/callback` (for consistency)
   - `http://localhost:{dynamic}/cb` (for new implementation)

2. **Standardize on Path**: Use `/cb` for new implementation (shorter, matches production pattern)

3. **Port Strategy**:
   - Use dynamic port allocation for OAuth listener
   - This avoids conflicts with other services
   - Matches the production redirect URI pattern without port specification

### Next Steps

This verification reveals that the OAuth implementation needs to be built from scratch as part of Task 4.0. The current codebase relies on:
- Hardcoded tokens in `src/quickbooks.ts`
- Manual token refresh via `npm run refresh-tokens`
- No automated OAuth flow

The new implementation will need to:
1. Create an OAuth listener server
2. Support dynamic port allocation
3. Use consistent `/cb` callback path
4. Work with both sandbox and production environments