# OAuth Token Display Fix for DXT Environment

## Problem
In the DXT environment, the OAuth success page was displaying the template string `${user_config.qb_refresh_token}` instead of the actual refresh token value.

## Root Cause
1. In DXT, environment variables are populated with template strings like `${user_config.qb_refresh_token}` which are replaced by Claude at runtime
2. After OAuth token exchange, the code was trying to read the token back from storage/environment, which still contained the template string
3. The OAuth success page was displaying this template string instead of the actual token

## Solution
Modified the `TokenManager.exchangeCodeForTokens()` method to return the actual token data that was just exchanged, rather than reading it back from storage. This ensures the OAuth listener receives the real token values to display.

### Changes Made:

1. **src/token-manager.ts**:
   - Changed `exchangeCodeForTokens()` return type from `Promise<void>` to `Promise<TokenData>`
   - Added return statement to return the actual token data after saving

2. **src/quickbooks-broker.ts**:
   - Updated to use the returned token data directly from `exchangeCodeForTokens()`
   - Removed the call to `getTokenData()` which was reading from storage

3. **Version Updates**:
   - package.json: 1.0.1 → 1.0.2
   - All manifest files: 2.0.4 → 2.0.5

## Result
The OAuth success page now displays the actual refresh token that was obtained during the OAuth flow, bypassing the environment variable template string issue in DXT environments.