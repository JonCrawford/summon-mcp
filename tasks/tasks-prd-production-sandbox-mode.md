## Relevant Files

- `src/config.ts` - New file to handle configuration parsing and validation for production mode
- `src/config.test.ts` - Unit tests for configuration logic
- `src/quickbooks.ts` - OAuth and QuickBooks client initialization (needs mode support)
- `tests/quickbooks.test.ts` - Tests for OAuth client with different modes
- `src/server.ts` - Server initialization and mode logging
- `tests/server.test.ts` - Tests for server startup with different modes
- `src/tools/index.ts` - Tool registration (may need mode awareness)
- `tests/tools.test.ts` - Tests for tools in different modes
- `.env.example` - Update with QUICKBOOKS_PRODUCTION variable example
- `CLAUDE.md` - Update documentation with production mode information
- `CLAUDE_DESKTOP_SETUP.md` - Update setup guide with production mode configuration
- `README.md` - Add production mode configuration instructions

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `config.ts` and `config.test.ts` in the same directory).
- Use `npm test` to run all tests or `npx vitest run [path/to/test/file]` for specific tests.
- Environment variable `QUICKBOOKS_PRODUCTION` should be used consistently throughout the codebase.
- Token files: `tokens.json` for production mode, `tokens_sandbox.json` for sandbox mode.
- Configuration errors should return valid JSON responses, not throw errors or log to console.

## Tasks

- [x] 1.0 Create Configuration Module with Graceful Error Handling
  - [x] 1.1 Create `src/config.ts` with `getConfig()` function that reads `QUICKBOOKS_PRODUCTION` env var
  - [x] 1.2 Implement default to sandbox mode when env var is missing, undefined, or not "true"
  - [x] 1.3 Create config type/interface with `isProduction: boolean` field
  - [x] 1.4 Handle missing INTUIT_CLIENT_ID/SECRET by returning error in JSON format (not throwing)
  - [x] 1.5 Write unit tests in `src/config.test.ts` for all config scenarios

- [ ] 2.0 Update OAuth and API URLs for Production/Sandbox Modes
  - [x] 2.1 Update `src/quickbooks.ts` to import and use config module
  - [ ] 2.2 Modify OAuth client initialization to use 'production' or 'sandbox' based on config
  - [ ] 2.3 Update QuickBooks client initialization to use correct environment
  - [ ] 2.4 Add constants for production OAuth URLs if different from sandbox
  - [ ] 2.5 Update tests to verify correct URLs are used for each mode

- [ ] 3.0 Implement Token Isolation (tokens.json and tokens_sandbox.json)
  - [ ] 3.1 Update `TOKENS_PATH` in `src/quickbooks.ts` to use `tokens.json` for production
  - [ ] 3.2 Add logic to use `tokens_sandbox.json` for sandbox mode
  - [ ] 3.3 Update `src/refresh-tokens.ts` to use correct token file based on mode
  - [ ] 3.4 Add token file path logic to `.gitignore` if needed
  - [ ] 3.5 Write tests to verify correct token file is used in each mode

- [ ] 4.0 Update Documentation for Production Mode Configuration
  - [ ] 4.1 Update `README.md` with production mode configuration example
  - [ ] 4.2 Update `CLAUDE_DESKTOP_SETUP.md` to show how to set `QUICKBOOKS_PRODUCTION` env var
  - [ ] 4.3 Update `claude-desktop-config-example.json` with production mode example
  - [ ] 4.4 Update `CLAUDE.md` with production/sandbox mode information
  - [ ] 4.5 Update `.env.example` to include `QUICKBOOKS_PRODUCTION` variable

- [ ] 5.0 Add Comprehensive Tests for Mode Switching
  - [ ] 5.1 Create integration test for sandbox mode OAuth flow
  - [ ] 5.2 Create integration test for production mode OAuth flow
  - [ ] 5.3 Add tests for tool execution in both modes
  - [ ] 5.4 Add tests for configuration validation and error handling
  - [ ] 5.5 Ensure all existing tests pass with the new mode configuration

## Testing Strategy

### Unit Tests
- Test configuration parsing in `src/config.test.ts`
  - Test default sandbox mode behavior
  - Test explicit production mode (`QUICKBOOKS_PRODUCTION=true`)
  - Test invalid values default to sandbox
  - Test missing credentials return JSON error
- Test token path generation for both modes
- Test OAuth URL selection based on mode

### Integration Tests
- Test full OAuth flow in sandbox mode
- Test full OAuth flow in production mode (with mocked responses)
- Test API calls go to correct endpoints
- Test token persistence in correct files

### End-to-End Tests
- Test server startup with various configurations
- Test tool execution in both modes
- Test error scenarios (missing credentials, invalid mode)

### Manual Testing Checklist
1. Start server without `QUICKBOOKS_PRODUCTION` - verify sandbox mode
2. Start server with `QUICKBOOKS_PRODUCTION=true` - verify production mode
3. Test OAuth flow in both modes
4. Verify tokens are saved to correct files
5. Test with missing credentials - verify JSON error response