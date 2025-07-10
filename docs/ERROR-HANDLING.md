# Error Handling System

This document describes the comprehensive error handling system implemented for the summon QuickBooks MCP Server.

## Overview

The error handling system provides standardized error types, automatic error categorization, and consistent error responses across the entire application. This improves debugging, user experience, and maintainability.

## Architecture

### Base Error Class

All errors inherit from `summonError`, which provides:

-   Standardized error codes and categories
-   MCP-compatible JSON responses
-   User-friendly error messages
-   Metadata for debugging
-   Retry indicators

```typescript
export abstract class summonError extends Error {
    public readonly errorCode: string;
    public readonly category: string;
    public readonly isRetryable: boolean;
    public readonly originalError?: Error;
    public readonly metadata?: Record<string, any>;
}
```

### Error Categories

#### Configuration Errors

-   **ConfigurationError**: Missing or invalid configuration
-   Used when: Environment variables are missing, invalid settings detected

#### Authentication & Authorization

-   **AuthenticationError**: Authentication failed or required
-   **AuthorizationError**: Access denied to resources
-   **TokenError**: Token-related issues (expired, invalid, missing)
-   **OAuthError**: OAuth flow failures

#### API Errors

-   **QuickBooksAPIError**: QuickBooks API failures
-   **RateLimitError**: API rate limiting (automatically retryable)
-   **NetworkError**: Network connectivity issues
-   **ConnectionError**: Connection failures

#### Data & Storage

-   **StorageError**: File system storage issues
-   **DatabaseError**: SQLite database errors

#### Operations

-   **ToolExecutionError**: MCP tool execution failures
-   **CompanyError**: Company/realm specific errors
-   **ValidationError**: Input validation failures

## Error Factory

The `ErrorFactory` provides automatic error conversion:

```typescript
// Convert QuickBooks API errors
const error = ErrorFactory.fromQuickBooksAPI(apiError, 'tool_name');

// Convert OAuth errors
const error = ErrorFactory.fromOAuth(oauthError, 'operation');

// Convert database errors
const error = ErrorFactory.fromDatabase(dbError, 'operation');

// Convert generic errors
const error = ErrorFactory.fromGenericError(genericError, 'category');
```

## Error Responses

### MCP-Compatible Responses

All errors can be converted to MCP-compatible JSON responses:

```typescript
const error = new AuthenticationError('Auth failed', true);
const response = error.toMCPResponse();
// Returns: { content: [{ type: 'text', text: JSON.stringify({...}) }] }
```

### User-Friendly Messages

Errors provide human-readable messages for Claude:

```typescript
const error = new RateLimitError();
const message = error.toUserMessage();
// Returns: "Rate limit exceeded. Please try again later. (you can try again)"
```

## Implementation Examples

### Tool Error Handling

```typescript
// Before: Generic error handling
catch (error) {
  throw new Error(`Failed to fetch customers: ${error.message}`);
}

// After: Standardized error handling
catch (error) {
  if (issummonError(error)) {
    throw error;
  }
  throw ErrorFactory.fromQuickBooksAPI(error, 'qb_list_customers');
}
```

### Configuration Error Handling

```typescript
// Before: Return error object or throw
if (!clientId || !clientSecret) {
    return {
        error: 'CONFIGURATION_ERROR',
        message: 'Missing credentials',
        details: 'Please set environment variables',
    };
}

// After: Throw standardized error
if (!clientId || !clientSecret) {
    throw new ConfigurationError(
        'Missing required QuickBooks OAuth credentials',
        undefined,
        {
            details: 'Please set QB_CLIENT_ID and QB_CLIENT_SECRET',
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret,
        }
    );
}
```

### OAuth Error Handling

```typescript
// Before: Generic error conversion
catch (error) {
  throw new Error(`OAuth flow failed: ${error.message}`);
}

// After: Proper OAuth error handling
catch (error) {
  if (issummonError(error)) {
    throw error;
  }
  throw ErrorFactory.fromOAuth(error, 'start_oauth_flow');
}
```

## Error Metadata

Errors can include rich metadata for debugging:

```typescript
const error = new QuickBooksAPIError(
    'API request failed',
    429,
    'RATE_LIMIT_EXCEEDED',
    true, // retryable
    originalError,
    {
        toolName: 'qb_list_customers',
        companyId: 'realm-123',
        requestId: 'req-456',
    }
);
```

## Utility Functions

### Type Guards

```typescript
import { issummonError } from './errors/index.js';

if (issummonError(error)) {
    // Handle summon error
    console.log(error.errorCode, error.category);
} else {
    // Handle generic error
    const standardError = ErrorFactory.fromGenericError(error);
}
```

### Async Error Handling

```typescript
import { handleAsyncError } from './errors/index.js';

const result = await handleAsyncError(someAsyncOperation(), (error) =>
    ErrorFactory.fromDatabase(error, 'save_tokens')
);
```

## Testing

The error system includes comprehensive tests covering:

-   Error creation and properties
-   MCP response formatting
-   Error factory conversions
-   Metadata handling
-   Type guards and utilities

Run error tests:

```bash
npm test src/errors/index.test.ts
```

## Migration Guide

### Phase 1: Core Error Classes ✅

-   [x] Created base `summonError` class
-   [x] Implemented specific error types
-   [x] Added `ErrorFactory` for conversions
-   [x] Created comprehensive tests

### Phase 2: System Integration ✅

-   [x] Updated configuration module
-   [x] Updated QuickBooks broker
-   [x] Updated token manager
-   [x] Updated MCP tools
-   [x] Updated minimal tools

### Phase 3: Benefits

1. **Consistent Error Responses**: All errors now follow the same format
2. **Better Debugging**: Rich metadata and error categorization
3. **Improved User Experience**: Clear, actionable error messages
4. **Retry Logic**: Automatic retry indicators for transient errors
5. **Type Safety**: TypeScript support for error types
6. **MCP Compatibility**: Proper JSON responses for MCP protocol

## Best Practices

1. **Always Use ErrorFactory**: Convert external errors to summon errors
2. **Preserve Original Errors**: Include original error in metadata
3. **Provide Context**: Add relevant metadata for debugging
4. **Check Retryability**: Set appropriate retry flags
5. **Test Error Paths**: Ensure error handling is tested
6. **Document Error Codes**: Maintain consistency in error codes

## Error Codes Reference

| Error Code             | Class               | Category       | Retryable | Description                      |
| ---------------------- | ------------------- | -------------- | --------- | -------------------------------- |
| `CONFIGURATION_ERROR`  | ConfigurationError  | configuration  | No        | Missing or invalid configuration |
| `AUTHENTICATION_ERROR` | AuthenticationError | authentication | Sometimes | Authentication failed            |
| `AUTHORIZATION_ERROR`  | AuthorizationError  | authorization  | No        | Access denied                    |
| `TOKEN_ERROR`          | TokenError          | token          | No        | Token issues                     |
| `OAUTH_ERROR`          | OAuthError          | oauth          | No        | OAuth flow failures              |
| `QUICKBOOKS_API_ERROR` | QuickBooksAPIError  | api            | No        | QuickBooks API errors            |
| `RATE_LIMIT_ERROR`     | RateLimitError      | api            | Yes       | Rate limit exceeded              |
| `NETWORK_ERROR`        | NetworkError        | network        | Yes       | Network connectivity             |
| `CONNECTION_ERROR`     | ConnectionError     | connection     | Yes       | Connection failures              |
| `STORAGE_ERROR`        | StorageError        | storage        | Sometimes | File system errors               |
| `DATABASE_ERROR`       | DatabaseError       | database       | Sometimes | SQLite errors                    |
| `TOOL_EXECUTION_ERROR` | ToolExecutionError  | tool           | No        | MCP tool failures                |
| `COMPANY_ERROR`        | CompanyError        | company        | No        | Company-specific errors          |
| `VALIDATION_ERROR`     | ValidationError     | validation     | No        | Input validation failures        |
| `UNKNOWN_ERROR`        | GenericsummonError  | unknown        | No        | Uncategorized errors             |

This error handling system provides a solid foundation for reliable error management throughout the summon application.
