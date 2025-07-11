# OAuth Windows Fix - Scope Parameter Issue

## Problem
On Windows, the OAuth authentication flow was failing with the error:
"The scope query parameter is missing from the authorization request"

This was happening despite the code appearing to correctly set the scope parameter using `OAuthClient.scopes.Accounting`.

## Root Cause
The issue appears to be related to how the ES module import of the `intuit-oauth` CommonJS library works on Windows. The static property `OAuthClient.scopes` may not be properly attached to the imported class in certain environments.

## Solution
Added robust fallback handling in `token-manager.ts`:

1. **Added fallback constant**: Defined `QUICKBOOKS_ACCOUNTING_SCOPE` as a constant fallback value
2. **Enhanced scope detection**: Check if `OAuthClient.scopes` exists before accessing the Accounting property
3. **Improved error handling**: Added extensive logging to diagnose the issue
4. **URL validation**: Added check to verify the generated URL contains the scope parameter
5. **Manual URL construction fallback**: If the library's `authorizeUri` method fails, manually construct the OAuth URL with all required parameters

## Changes Made

### src/token-manager.ts
- Added `QUICKBOOKS_ACCOUNTING_SCOPE` constant
- Enhanced `generateAuthUrl` method with:
  - Detailed logging of OAuthClient properties
  - Fallback scope handling when OAuthClient.scopes is undefined
  - URL validation to ensure scope parameter is present
  - Manual URL construction as final fallback
- Added debugging to `initOAuthClient` method
- Fixed TypeScript type issues with cast to `any` for client properties

### Version Updates
- package.json: 2.0.19 → 2.0.20
- manifest.json: 2.0.19 → 2.0.20

## Testing Recommendations
1. Test on Windows with the updated build
2. Check console logs for any warnings about missing OAuthClient.scopes
3. Verify the OAuth URL contains the scope parameter
4. If manual URL construction is used, verify it works correctly

## Future Improvements
Consider:
1. Adding TypeScript type definitions for intuit-oauth library
2. Contributing a fix upstream if this is a library issue
3. Creating a wrapper module that ensures consistent behavior across platforms