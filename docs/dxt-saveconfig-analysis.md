# dxt.saveConfig() Runtime Helper Analysis

## Overview
The `dxt.saveConfig()` runtime helper is mentioned in the OAuth secure storage PRD as a method to update user configuration at runtime, specifically for storing OAuth refresh tokens securely.

## Expected Functionality

### Purpose
- Update sensitive configuration values at runtime without requiring extension restart
- Store OAuth refresh tokens after successful authentication
- Maintain values in OS-secure storage (Keychain/Credential Manager)

### Expected API
```typescript
// After OAuth callback receives new refresh token
await dxt.saveConfig({
  qb_refresh_token: newRefreshToken
});
```

### Integration Points
1. **OAuth Callback Handler**: After exchanging authorization code for tokens
2. **Token Refresh**: When Intuit rotates refresh tokens
3. **Token Revocation**: Clear stored tokens when user disconnects

## Current Status
- **Not Found in Public Docs**: No official documentation available yet
- **Likely v0.2.0 Feature**: Part of upcoming DXT enhancements
- **Need Feature Detection**: Must check availability at runtime

## Implementation Strategy

### 1. Feature Detection Pattern
```typescript
interface DxtRuntime {
  saveConfig?: (config: Record<string, any>) => Promise<void>;
}

declare global {
  var dxt: DxtRuntime | undefined;
}

export function hasDxtSaveConfig(): boolean {
  return typeof globalThis.dxt?.saveConfig === 'function';
}
```

### 2. Wrapper with Fallback
```typescript
export async function saveRefreshToken(token: string): Promise<void> {
  if (hasDxtSaveConfig()) {
    // Use DXT runtime helper
    await globalThis.dxt!.saveConfig({
      qb_refresh_token: token
    });
  } else {
    // Fallback to file-based storage
    await saveTokenToFile(token);
  }
}
```

### 3. Mock for Testing
```typescript
// In tests
global.dxt = {
  saveConfig: jest.fn().mockResolvedValue(undefined)
};
```

## Security Considerations

1. **Validation**: Ensure only allowed config keys can be updated
2. **Encryption**: Values should be encrypted by OS keychain
3. **Access Control**: Only the extension should update its own config
4. **Audit Trail**: Log config updates for security monitoring

## Migration Path

### Phase 1: Current Implementation
- Use environment variables for initial config
- Store tokens in encrypted files
- Prepare abstraction layer for easy migration

### Phase 2: DXT v0.2.0 Adoption
- Add feature detection
- Implement dxt.saveConfig() calls
- Maintain backward compatibility
- Test on both macOS and Windows

## Testing Approach

1. **Unit Tests**: Mock the dxt global and saveConfig method
2. **Integration Tests**: Test with and without dxt runtime
3. **Manual Testing**: Verify OS keychain integration

## Conclusion
While `dxt.saveConfig()` is not yet available in public documentation, we should implement our OAuth flow with a proper abstraction layer that can easily adopt this feature when it becomes available. The feature detection pattern ensures our extension works in both current and future DXT environments.