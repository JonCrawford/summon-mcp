## Relevant Files

- `manifest.json` - Primary configuration file that needs user_config and server environment variable updates
- `manifest-broker.json` - Broker manifest that also needs the same user_config updates
- `src/token-manager.ts` - New module to handle token lifecycle management and secure storage
- `src/token-manager.test.ts` - Unit tests for token management functionality
- `src/oauth-listener.ts` - New module to handle OAuth callback listener and PKCE flow
- `src/oauth-listener.test.ts` - Unit tests for OAuth listener functionality
- `src/server-broker.ts` - Main server file that needs ensureAuth() integration
- `src/quickbooks-broker.ts` - QuickBooks client that needs token manager integration
- `src/tools/index.ts` - Tool factory that needs authentication wrapper
- `.env.example` - Update with new environment variable documentation
- `README.md` - Documentation updates for OAuth flow explanation
- `package.json` - Dependencies for OAuth implementation (get-port, PKCE libraries)
- `tests/mcp-protocol.test.ts` - Raw MCP protocol handshake tests (created)
- `tests/mcp-protocol-sdk.test.ts` - SDK-based MCP protocol tests (created)
- `tests/mcp-initialization.test.ts` - MCP initialization compliance tests (created)
- `tests/mcp-handshake-compliance.test.ts` - Comprehensive handshake compliance tests (created)
- `tests/server-compliance-verification.test.ts` - Server compliance verification tests (created)
- `src/server-safe.ts` - Alternative safe server implementation (created)
- `src/server-compliant.ts` - MCP compliant server implementation (created)
- `docs/dxt-v0.2.0-research.md` - Research summary for DXT v0.2.0 features (created)

### Notes

- Unit tests should be placed alongside the code files they are testing
- Use `npm test` to run the full test suite
- OAuth flow will require manual browser interaction for integration testing
- Consider using MSW (Mock Service Worker) for mocking Intuit OAuth endpoints in tests

## Tasks

- [x] 0.0 MCP Protocol Compliance Testing and Fixes
  - [x] 0.1 Create comprehensive MCP protocol initialization tests
  - [x] 0.2 Test that server completes handshake even with missing configuration
  - [x] 0.3 Remove all process.exit() calls that occur before MCP handshake
  - [x] 0.4 Replace early exits with proper error reporting through MCP protocol
  - [x] 0.5 Ensure server starts and responds to initialize request in all scenarios
  - [x] 0.6 Test server behavior with missing OAuth credentials
  - [x] 0.7 Verify stdio transport doesn't get blocked by synchronous operations
  - [x] 0.8 Add integration test that spawns server and validates full handshake

- [ ] 1.0 Prep and Discovery
  - [x] 1.1 Research DXT v0.2.0 manifest changes and user_config validation features
  - [ ] 1.2 Review the dxt.saveConfig() runtime helper documentation
  - [ ] 1.3 Update Intuit app settings to add production redirect URI: https://127-0-0-1.sslip.io/cb
  - [ ] 1.4 Verify existing sandbox redirect URI: http://localhost:{port}/cb
  - [ ] 1.5 Test sslip.io DNS resolution (confirm 127-0-0-1.sslip.io resolves to 127.0.0.1)
  - [ ] 1.6 Document OAuth flow architecture and security considerations

- [ ] 2.0 Implement DXT Secure Storage Configuration
  - [ ] 2.1 Update manifest.json with user_config section for sensitive fields
  - [ ] 2.2 Add qb_client_id field with type:"string", sensitive:true, required:true
  - [ ] 2.3 Add qb_client_secret field with type:"string", sensitive:true, required:true
  - [ ] 2.4 Add qb_refresh_token field with type:"string", sensitive:true, required:false
  - [ ] 2.5 Configure server.mcp_config.env to map user_config to environment variables
  - [ ] 2.6 Update manifest-broker.json with identical user_config changes
  - [ ] 2.7 Remove hardcoded credentials from any existing configuration files

- [ ] 3.0 Build Token Manager Module
  - [ ] 3.1 Create src/token-manager.ts with TokenManager class
  - [ ] 3.2 Implement detectRefreshToken() to check process.env.QB_REFRESH_TOKEN
  - [ ] 3.3 Build refreshAccessToken() method to exchange refresh token for access token
  - [ ] 3.4 Implement token caching with expiry tracking in memory
  - [ ] 3.5 Add saveRefreshToken() method using dxt.saveConfig() helper
  - [ ] 3.6 Handle Intuit's rotating refresh tokens (update stored token after each refresh)
  - [ ] 3.7 Create comprehensive unit tests for all token manager methods
  - [ ] 3.8 Add error handling for token refresh failures and network issues

- [ ] 4.0 Create OAuth Callback Listener
  - [ ] 4.1 Install dependencies: get-port, express (or alternative), crypto for PKCE
  - [ ] 4.2 Create src/oauth-listener.ts with OAuthListener class
  - [ ] 4.3 Implement findFreePort() using get-port or socket trick
  - [ ] 4.4 Build startListener() to spin up Express server on free port
  - [ ] 4.5 Create /cb route handler for OAuth callback
  - [ ] 4.6 Implement PKCE code verifier/challenge generation
  - [ ] 4.7 Build exchangeCodeForTokens() with PKCE validation
  - [ ] 4.8 Add automatic server shutdown after successful token exchange
  - [ ] 4.9 Ensure all logs go to stderr to keep stdio transport clean
  - [ ] 4.10 Write unit tests for OAuth listener components

- [ ] 5.0 Integrate OAuth Flow with MCP Tools
  - [ ] 5.1 Create ensureAuth() wrapper function in quickbooks-broker.ts
  - [ ] 5.2 Build OAuth URL with required parameters (client_id, redirect_uri, scope, state, PKCE)
  - [ ] 5.3 Implement browser launch functionality (open/xdg-open)
  - [ ] 5.4 Wrap all QuickBooks tool calls with ensureAuth() check
  - [ ] 5.5 Define WAITING_FOR_OAUTH error type for user-facing messages
  - [ ] 5.6 Handle retry logic after successful OAuth authorization
  - [ ] 5.7 Add sandbox vs production redirect URI switching based on environment
  - [ ] 5.8 Test OAuth flow end-to-end with real Intuit sandbox

- [ ] 6.0 Package and Test DXT Extension
  - [ ] 6.1 Run dxt lint to validate manifest changes
  - [ ] 6.2 Build TypeScript code with npm run build
  - [ ] 6.3 Package extension with dxt pack command
  - [ ] 6.4 Test fresh install flow on macOS (Keychain integration)
  - [ ] 6.5 Test fresh install flow on Windows (Credential Manager integration)
  - [ ] 6.6 Verify token persistence across extension restarts
  - [ ] 6.7 Test vault wipe scenario and re-authentication flow
  - [ ] 6.8 Validate MCP protocol compliance (no process.exit before handshake)

- [ ] 7.0 Documentation and Support Materials
  - [ ] 7.1 Update README.md with "How OAuth Works" section
  - [ ] 7.2 Add FAQ entry explaining sslip.io usage
  - [ ] 7.3 Document environment variable changes in .env.example
  - [ ] 7.4 Create troubleshooting guide for common OAuth issues
  - [ ] 7.5 Record screen capture video of first-run experience
  - [ ] 7.6 Write migration guide for users upgrading from hardcoded credentials
  - [ ] 7.7 Tag release and prepare release notes

## Testing Strategy

### Unit Tests
- Test token manager's refresh logic with mocked Intuit API responses
- Verify PKCE implementation generates valid challenges and verifiers
- Test OAuth listener's callback handling with various success/error scenarios
- Mock dxt.saveConfig() calls to verify refresh token updates

### Integration Tests
- Create end-to-end test script that simulates full OAuth flow
- Test token refresh scenarios with expired/invalid tokens
- Verify proper error handling when OAuth is interrupted
- Test switching between sandbox and production environments

### Manual Testing Checklist
- Fresh install prompts for client ID/secret
- Browser opens to correct Intuit authorization URL
- Callback successfully exchanges code for tokens
- Subsequent API calls work without re-authentication
- Extension restart maintains authentication state
- Clearing OS credential store triggers re-authentication