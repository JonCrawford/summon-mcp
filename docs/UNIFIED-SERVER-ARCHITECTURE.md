# Unified Server Architecture

This document describes the new unified server architecture that replaces the previous multiple server implementations with a single, environment-aware server.

## Overview

The unified server (`src/server-unified.ts`) automatically detects its deployment environment and configures itself appropriately. This eliminates the confusion of multiple server entry points while maintaining compatibility with all deployment scenarios.

## Server Modes

The server automatically detects and runs in one of three modes:

### 1. DXT Mode
- **Detection**: `DXT_ENVIRONMENT=true` environment variable
- **Characteristics**: 
  - No file logging (DXT environment is read-only)
  - Full OAuth capability with browser opening
  - All resources and prompts enabled
  - Version 2.0.7

### 2. Production Mode
- **Detection**: `NODE_ENV=production` environment variable
- **Characteristics**:
  - File logging enabled
  - All features enabled
  - Graceful error handling with process exit
  - Version 2.0.7

### 3. Development Mode (Default)
- **Detection**: Default when no specific environment is set
- **Characteristics**:
  - File logging enabled for debugging
  - All features enabled
  - Continued execution on errors for debugging
  - Version 1.0.0

## Architecture Benefits

### 1. Single Entry Point
- No more confusion about which server file to use
- One implementation to maintain and test
- Clear deployment path for all environments

### 2. Environment Auto-Detection
- Automatic configuration based on deployment context
- No manual server selection required
- Consistent behavior across environments

### 3. Unified Feature Set
- All tools, resources, and prompts available in all modes
- Consistent API across deployment scenarios
- Same integration tests work for all modes

## Migration from Legacy Servers

### Before (Multiple Servers)
```
src/server.ts              # Local development
src/server-broker.ts        # DXT deployment
src/server-dxt.ts          # DXT read-only mode
src/server-safe.ts         # Safe mode with error handling
src/server-compliant.ts    # MCP compliant mode
```

### After (Unified Server)
```
src/server-unified.ts      # Single server for all environments
```

### Manifest Updates
Update your manifest files to use the unified server:

```json
{
  "server": {
    "type": "node",
    "entry_point": "dist/server-unified.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/dist/server-unified.js"],
      "env": {
        "DXT_ENVIRONMENT": "true",
        // ... other environment variables
      }
    }
  }
}
```

## Core Tools

All server modes provide these core tools:

1. **health_check**: Server status and mode information
2. **authenticate**: QuickBooks OAuth flow (mode-aware)
3. **clear_auth**: Clear authentication tokens
4. **qb_list_companies**: List connected companies

Additional QuickBooks entity tools are registered dynamically after authentication.

## Configuration

The server uses the same environment variables across all modes:

```bash
QB_CLIENT_ID=your_client_id
QB_CLIENT_SECRET=your_client_secret
QB_PRODUCTION=true|false
QB_STORAGE_DIR=/path/to/storage
DXT_ENVIRONMENT=true        # For DXT mode
NODE_ENV=production         # For production mode
```

## Implementation Details

### Lazy Initialization
- Components are initialized only when needed
- Prevents startup crashes from missing dependencies
- Allows server to start and report issues through MCP protocol

### Error Handling
- Mode-specific error handling strategies
- Development mode continues on errors for debugging
- Production mode exits gracefully after logging
- DXT mode optimized for extension environment

### Logging Strategy
- File logging disabled in DXT mode (read-only environment)
- Stderr logging available in all modes
- Debug information includes current mode

## Testing

The unified server is tested with the same comprehensive integration test suite:

```bash
# Test the unified server
npm test -- tests/server-unified.integration.test.ts

# Run all tests to ensure compatibility
npm test
```

## Deployment

### Local Development
```bash
# No special configuration needed
npm run build
node dist/server-unified.js
```

### DXT Packaging
```bash
# Build and package
npm run build
npx @anthropic-ai/dxt pack . quickbooks-mcp.dxt
```

### Production Deployment
```bash
# Set production environment
export NODE_ENV=production
export QB_PRODUCTION=true
npm run build
node dist/server-unified.js
```

## Legacy Server Status

The following legacy servers are now deprecated and should not be used:

- ❌ `server.ts` - Use `server-unified.ts` instead
- ❌ `server-broker.ts` - Use `server-unified.ts` instead  
- ❌ `server-dxt.ts` - Use `server-unified.ts` instead
- ❌ `server-safe.ts` - Use `server-unified.ts` instead
- ❌ `server-compliant.ts` - Use `server-unified.ts` instead

These files are kept for reference but will be removed in a future version.

## Future Improvements

The unified architecture provides a foundation for:

1. **Dynamic Feature Registration**: Environment-specific tool sets
2. **Enhanced Configuration**: Mode-specific optimizations
3. **Better Monitoring**: Unified logging and metrics
4. **Simplified Deployment**: Single artifact for all environments