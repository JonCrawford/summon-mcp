# Product Requirements Document: Production/Sandbox Mode Configuration

## Introduction/Overview

This feature adds a configuration option to the QuickBooks MCP server that allows users to specify whether they want to connect to QuickBooks Online in production mode or sandbox mode. This enables developers to test the integration using QuickBooks sandbox accounts without requiring access to a real business's production QuickBooks account. The mode is configured in the MCP JSON configuration and cannot be changed at runtime.

## Goals

1. Enable developers to test QuickBooks integration using sandbox accounts
2. Provide a simple boolean configuration flag in the MCP JSON configuration
3. Ensure all QuickBooks API calls respect the configured mode
4. Default to sandbox mode for safety
5. Clearly indicate which mode the server is running in

## User Stories

1. **As a developer**, I want to test the QuickBooks MCP server with a sandbox account so that I can develop and test without needing access to a real business's QuickBooks data.

2. **As a developer**, I want to easily configure the server for production mode when I'm ready to work with real business data.

3. **As a system administrator**, I want the server to default to sandbox mode so that accidental connections to production are avoided.

4. **As a developer**, I want clear feedback about which mode the server is running in so that I can verify my configuration is correct.

## Functional Requirements

1. **Configuration Field**: The system must accept a `production` boolean field in the MCP JSON configuration
   - `true` = production mode
   - `false` = sandbox mode (default)

2. **Default Behavior**: The system must default to sandbox mode when:
   - No `production` field is specified
   - The `production` field is null or undefined
   - The `production` field is explicitly set to `false`

3. **OAuth URLs**: The system must use different OAuth URLs based on the mode:
   - Sandbox: Current URLs (already implemented)
   - Production: Production QuickBooks OAuth URLs

4. **API Endpoints**: The system must direct all QuickBooks API calls to the appropriate environment:
   - Sandbox: `sandbox-quickbooks.api.intuit.com`
   - Production: `quickbooks.api.intuit.com`

5. **Mode Indication**: The system must clearly indicate the current mode in:
   - Server startup logs
   - Health check responses
   - The Server Info resource

6. **Configuration Validation**: The system must validate the `production` field:
   - Accept only boolean values (true/false)
   - Reject invalid values with clear error messages

7. **Token Isolation**: The system must store tokens separately for each mode:
   - Sandbox tokens: `tokens-sandbox.json`
   - Production tokens: `tokens-production.json`

8. **Environment Propagation**: The mode setting must be propagated to:
   - OAuth client initialization
   - QuickBooks client initialization
   - All API calls

## Non-Goals (Out of Scope)

1. Runtime mode switching - mode is fixed at server startup
2. UI for mode selection - configuration is only via JSON
3. Automatic mode detection based on credentials
4. Migration tools between sandbox and production
5. Different feature sets between modes

## Design Considerations

### Configuration Examples

**Sandbox Mode (Default):**
```json
{
  "mcpServers": {
    "quickbooks-mcp": {
      "command": "npx",
      "args": ["tsx", "src/server.ts"],
      "cwd": "/path/to/quickbooks-mcp2",
      "env": {
        "INTUIT_CLIENT_ID": "sandbox_client_id",
        "INTUIT_CLIENT_SECRET": "sandbox_client_secret"
      }
    }
  }
}
```

**Production Mode:**
```json
{
  "mcpServers": {
    "quickbooks-mcp": {
      "command": "npx",
      "args": ["tsx", "src/server.ts"],
      "cwd": "/path/to/quickbooks-mcp2",
      "env": {
        "INTUIT_CLIENT_ID": "production_client_id",
        "INTUIT_CLIENT_SECRET": "production_client_secret",
        "QUICKBOOKS_PRODUCTION": "true"
      }
    }
  }
}
```

### Visual Feedback

- Startup log: `[QuickBooks MCP] Starting in SANDBOX mode`
- Health check response: Include `"mode": "sandbox"` or `"mode": "production"`
- Server Info resource: Include mode in the capabilities

## Technical Considerations

1. **Environment Variable**: Use `QUICKBOOKS_PRODUCTION` environment variable to pass the configuration
2. **Type Safety**: Use TypeScript to ensure boolean type for the production flag
3. **Configuration Loading**: Read from `process.env.QUICKBOOKS_PRODUCTION === 'true'`
4. **OAuth Client**: Parameterize the OAuth client's `environment` setting
5. **API Base URLs**: Create constants for sandbox and production API URLs
6. **Error Handling**: Fail fast with clear errors if production credentials are used in sandbox mode or vice versa

## Success Metrics

1. **Configuration Success**: 100% of configurations with valid boolean values are accepted
2. **Mode Accuracy**: 100% of API calls go to the correct environment (sandbox vs production)
3. **Default Safety**: 100% of unconfigured instances default to sandbox mode
4. **Clear Feedback**: Mode is clearly indicated in logs and health checks
5. **Test Coverage**: All mode-dependent code paths have test coverage

## Open Questions

1. Should we validate that the OAuth credentials match the selected mode (e.g., prevent using sandbox credentials in production mode)?
2. Should the health check endpoint expose the current mode for debugging purposes, or is this a security concern?
3. Should we add a warning when running in production mode to ensure users are aware?
4. Do we need different rate limiting or error handling strategies between sandbox and production modes?

## Testing Requirements

1. **Unit Tests**:
   - Configuration parsing with various inputs (true, false, undefined, null, invalid)
   - OAuth URL generation for both modes
   - Token file path generation for both modes

2. **Integration Tests**:
   - API calls go to correct endpoints in each mode
   - OAuth flow works correctly in both modes
   - Token storage isolation between modes

3. **End-to-End Tests**:
   - Server starts successfully in both modes
   - Health check reports correct mode
   - All tools work correctly in each mode

4. **Error Case Tests**:
   - Invalid configuration values are rejected
   - Mismatched credentials are handled gracefully
   - Clear error messages for configuration issues