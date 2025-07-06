# DXT v0.2.0 Research Summary

## Overview
Based on research and the PRD requirements, DXT v0.2.0 introduces new features for secure storage and runtime configuration updates in Desktop Extensions.

## Key Features Expected in v0.2.0

### 1. User Configuration with Secure Storage
```json
"user_config": {
  "qb_client_id": {
    "type": "string",
    "title": "QuickBooks Client ID",
    "description": "Your QuickBooks OAuth client ID",
    "sensitive": true,
    "required": true
  },
  "qb_client_secret": {
    "type": "string", 
    "title": "QuickBooks Client Secret",
    "description": "Your QuickBooks OAuth client secret",
    "sensitive": true,
    "required": true
  },
  "qb_refresh_token": {
    "type": "string",
    "title": "QuickBooks Refresh Token",
    "description": "OAuth refresh token (automatically managed)",
    "sensitive": true,
    "required": false
  }
}
```

Key features:
- `sensitive: true` - Values stored in OS keychain/credential manager
- `required: false` - For tokens that get populated at runtime
- Claude Desktop handles UI generation and secure storage

### 2. Environment Variable Mapping
```json
"server": {
  "mcp_config": {
    "env": {
      "QB_CLIENT_ID": "${user_config.qb_client_id}",
      "QB_CLIENT_SECRET": "${user_config.qb_client_secret}",
      "QB_REFRESH_TOKEN": "${user_config.qb_refresh_token}"
    }
  }
}
```

- Template variables map user_config to environment variables
- Values injected securely at runtime
- No plaintext storage in config files

### 3. Runtime Configuration Updates (dxt.saveConfig)

Expected API (based on PRD):
```typescript
// After successful OAuth flow
await dxt.saveConfig({
  qb_refresh_token: newRefreshToken
});
```

This runtime helper likely:
- Updates the secure storage with new values
- Persists across extension restarts
- Maintains encryption in OS keychain
- Does NOT require extension restart

## Implementation Strategy

Since DXT v0.2.0 features may not be fully available yet, we should:

### Phase 1: Current Implementation
1. Use existing environment variables approach
2. Store tokens in encrypted files (current approach)
3. Prepare code structure for easy migration

### Phase 2: DXT v0.2.0 Migration
When features become available:
1. Update manifest.json with user_config
2. Replace file-based token storage with dxt.saveConfig()
3. Test OS keychain integration on macOS/Windows

## Verification Approach

1. Check if `dxt` global object exists in runtime
2. Feature detection for `dxt.saveConfig` method
3. Fallback to file-based storage if not available

```typescript
// Feature detection
const hasDxtRuntime = typeof globalThis.dxt !== 'undefined';
const hasSaveConfig = hasDxtRuntime && typeof globalThis.dxt.saveConfig === 'function';

if (hasSaveConfig) {
  // Use dxt.saveConfig
  await globalThis.dxt.saveConfig({ qb_refresh_token: token });
} else {
  // Fallback to file storage
  await saveTokenToFile(token);
}
```

## Next Steps

1. Continue with OAuth implementation using current approach
2. Structure code to easily adopt dxt.saveConfig when available
3. Monitor DXT documentation for v0.2.0 release
4. Test with beta version if available