/**
 * Custom Error Classes for summon QuickBooks MCP Server
 *
 * Provides standardized error handling with proper categorization,
 * MCP-compatible error responses, and improved debugging.
 */

// Base error class for all summon errors
export abstract class summonError extends Error {
    public readonly errorCode: string;
    public readonly category: string;
    public readonly isRetryable: boolean;
    public readonly originalError?: Error;
    public readonly metadata?: Record<string, any>;

    constructor(
        message: string,
        errorCode: string,
        category: string,
        isRetryable: boolean = false,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(message);
        this.name = this.constructor.name;
        this.errorCode = errorCode;
        this.category = category;
        this.isRetryable = isRetryable;
        this.originalError = originalError;
        this.metadata = metadata;

        // Maintain proper stack trace in V8 engines
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Convert to MCP-compatible error response
     */
    toMCPResponse(): { content: Array<{ type: 'text'; text: string }> } {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(
                        {
                            error: this.errorCode,
                            message: this.message,
                            category: this.category,
                            retryable: this.isRetryable,
                            metadata: this.metadata,
                        },
                        null,
                        2
                    ),
                },
            ],
        };
    }

    /**
     * Convert to user-friendly message for Claude
     */
    toUserMessage(): string {
        return `${this.message}${
            this.isRetryable ? ' (you can try again)' : ''
        }`;
    }
}

// Configuration-related errors
export class ConfigurationError extends summonError {
    constructor(
        message: string,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(
            message,
            'CONFIGURATION_ERROR',
            'configuration',
            false,
            originalError,
            metadata
        );
    }
}

// Authentication and authorization errors
export class AuthenticationError extends summonError {
    constructor(
        message: string,
        isRetryable: boolean = false,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(
            message,
            'AUTHENTICATION_ERROR',
            'authentication',
            isRetryable,
            originalError,
            metadata
        );
    }
}

export class AuthorizationError extends summonError {
    constructor(
        message: string,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(
            message,
            'AUTHORIZATION_ERROR',
            'authorization',
            false,
            originalError,
            metadata
        );
    }
}

export class TokenError extends summonError {
    constructor(
        message: string,
        isRetryable: boolean = false,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(
            message,
            'TOKEN_ERROR',
            'token',
            isRetryable,
            originalError,
            metadata
        );
    }
}

// QuickBooks API errors
export class QuickBooksAPIError extends summonError {
    public readonly statusCode?: number;
    public readonly apiErrorCode?: string;

    constructor(
        message: string,
        statusCode?: number,
        apiErrorCode?: string,
        isRetryable: boolean = false,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(
            message,
            'QUICKBOOKS_API_ERROR',
            'api',
            isRetryable,
            originalError,
            {
                statusCode,
                apiErrorCode,
                ...metadata,
            }
        );
        this.statusCode = statusCode;
        this.apiErrorCode = apiErrorCode;
    }
}

export class RateLimitError extends summonError {
    constructor(
        message: string = 'Rate limit exceeded. Please try again later.',
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(
            message,
            'RATE_LIMIT_ERROR',
            'api',
            true,
            originalError,
            metadata
        );
    }
}

// Database and storage errors
export class StorageError extends summonError {
    constructor(
        message: string,
        isRetryable: boolean = false,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(
            message,
            'STORAGE_ERROR',
            'storage',
            isRetryable,
            originalError,
            metadata
        );
    }
}

export class DatabaseError extends summonError {
    constructor(
        message: string,
        isRetryable: boolean = false,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(
            message,
            'DATABASE_ERROR',
            'database',
            isRetryable,
            originalError,
            metadata
        );
    }
}

// Network and connection errors
export class NetworkError extends summonError {
    constructor(
        message: string,
        isRetryable: boolean = true,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(
            message,
            'NETWORK_ERROR',
            'network',
            isRetryable,
            originalError,
            metadata
        );
    }
}

export class ConnectionError extends summonError {
    constructor(
        message: string,
        isRetryable: boolean = true,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(
            message,
            'CONNECTION_ERROR',
            'connection',
            isRetryable,
            originalError,
            metadata
        );
    }
}

// OAuth-specific errors
export class OAuthError extends summonError {
    public readonly oauthErrorCode?: string;

    constructor(
        message: string,
        oauthErrorCode?: string,
        isRetryable: boolean = false,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(message, 'OAUTH_ERROR', 'oauth', isRetryable, originalError, {
            oauthErrorCode,
            ...metadata,
        });
        this.oauthErrorCode = oauthErrorCode;
    }
}

// Validation errors
export class ValidationError extends summonError {
    constructor(
        message: string,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(
            message,
            'VALIDATION_ERROR',
            'validation',
            false,
            originalError,
            metadata
        );
    }
}

// Tool execution errors
export class ToolExecutionError extends summonError {
    public readonly toolName: string;

    constructor(
        message: string,
        toolName: string,
        isRetryable: boolean = false,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(
            message,
            'TOOL_EXECUTION_ERROR',
            'tool',
            isRetryable,
            originalError,
            {
                toolName,
                ...metadata,
            }
        );
        this.toolName = toolName;
    }
}

// Company/realm specific errors
export class CompanyError extends summonError {
    public readonly companyName?: string;

    constructor(
        message: string,
        companyName?: string,
        originalError?: Error,
        metadata?: Record<string, any>
    ) {
        super(message, 'COMPANY_ERROR', 'company', false, originalError, {
            companyName,
            ...metadata,
        });
        this.companyName = companyName;
    }
}

/**
 * Error factory for creating appropriate error types based on context
 */
export class ErrorFactory {
    /**
     * Create error from QuickBooks API response
     */
    static fromQuickBooksAPI(error: any, toolName?: string): summonError {
        // Handle authentication errors
        if (error.authData?.statusCode === 401 || error.statusCode === 401) {
            return new AuthenticationError(
                'Authentication failed. Please reconnect to QuickBooks using the authenticate tool',
                true,
                error,
                { toolName }
            );
        }

        // Handle rate limiting
        if (error.statusCode === 429) {
            return new RateLimitError(undefined, error, { toolName });
        }

        // Handle authorization errors
        if (error.statusCode === 403) {
            return new AuthorizationError(
                'Access denied. Please check your QuickBooks permissions.',
                error,
                { toolName }
            );
        }

        // Handle network errors
        if (
            error.code === 'ECONNRESET' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ETIMEDOUT'
        ) {
            return new NetworkError(
                'Network error occurred while connecting to QuickBooks API',
                true,
                error,
                { toolName }
            );
        }

        // Log the full error for debugging
        console.error('QuickBooks API Error Details:', {
            message: error.message,
            statusCode: error.statusCode,
            code: error.code,
            body: error.body,
            fault: error.fault,
            toolName: toolName
        });

        // Try to extract more specific error message
        let errorMessage = 'QuickBooks API error occurred';
        if (error.message) {
            errorMessage = error.message;
        } else if (error.fault?.error) {
            errorMessage = error.fault.error.map((e: any) => e.message || e.detail).join(', ');
        } else if (error.body) {
            errorMessage = `QuickBooks API error: ${JSON.stringify(error.body)}`;
        }

        // Default to API error
        return new QuickBooksAPIError(
            errorMessage,
            error.statusCode,
            error.code,
            false,
            error,
            { toolName, fullError: error }
        );
    }

    /**
     * Create error from OAuth operation
     */
    static fromOAuth(error: any, operation?: string): summonError {
        // Handle expired refresh token
        if (error.authResponse?.response?.error === 'invalid_grant') {
            return new TokenError(
                'Refresh token expired. Please reconnect to QuickBooks.',
                false,
                error,
                { operation }
            );
        }

        // Handle OAuth-specific errors
        if (error.authResponse?.response?.error) {
            return new OAuthError(
                `OAuth error: ${error.authResponse.response.error}`,
                error.authResponse.response.error,
                false,
                error,
                { operation }
            );
        }

        // Default to OAuth error
        return new OAuthError(
            error.message || 'OAuth operation failed',
            undefined,
            false,
            error,
            { operation }
        );
    }

    /**
     * Create error from database operation
     */
    static fromDatabase(error: any, operation?: string): summonError {
        // Handle SQLite-specific errors
        if (error.code === 'SQLITE_BUSY') {
            return new DatabaseError(
                'Database is busy. Please try again.',
                true,
                error,
                { operation }
            );
        }

        if (error.code === 'SQLITE_CORRUPT') {
            return new DatabaseError(
                'Database is corrupted. Please clear authentication and reconnect.',
                false,
                error,
                { operation }
            );
        }

        // Default to database error
        return new DatabaseError(
            error.message || 'Database operation failed',
            false,
            error,
            { operation }
        );
    }

    /**
     * Create error from configuration issues
     */
    static fromConfiguration(
        message: string,
        details?: string
    ): ConfigurationError {
        return new ConfigurationError(message, undefined, { details });
    }

    /**
     * Create error from tool execution
     */
    static fromToolExecution(error: any, toolName: string): ToolExecutionError {
        return new ToolExecutionError(
            error.message || `Tool execution failed: ${toolName}`,
            toolName,
            false,
            error
        );
    }

    /**
     * Create error from generic JavaScript error
     */
    static fromGenericError(
        error: any,
        category: string = 'unknown'
    ): summonError {
        if (error instanceof summonError) {
            return error;
        }

        const message = error.message || 'Unknown error occurred';

        // Try to categorize based on error message/type
        if (
            message.toLowerCase().includes('authentication') ||
            message.toLowerCase().includes('auth')
        ) {
            return new AuthenticationError(message, false, error);
        }

        if (
            message.toLowerCase().includes('network') ||
            message.toLowerCase().includes('connection')
        ) {
            return new NetworkError(message, true, error);
        }

        if (message.toLowerCase().includes('token')) {
            return new TokenError(message, false, error);
        }

        // Default to generic summon error
        return new (class GenericsummonError extends summonError {
            constructor() {
                super(message, 'UNKNOWN_ERROR', category, false, error);
            }
        })();
    }
}

/**
 * Type guard to check if an error is a summon error
 */
export function issummonError(error: any): error is summonError {
    return error instanceof summonError;
}

/**
 * Helper function to handle errors in async operations
 */
export function handleAsyncError<T>(
    promise: Promise<T>,
    errorFactory: (error: any) => summonError
): Promise<T> {
    return promise.catch((error) => {
        throw errorFactory(error);
    });
}

/**
 * Decorator for automatic error handling in methods
 */
export function withErrorHandling(errorFactory: (error: any) => summonError) {
    return function (
        target: any,
        _propertyKey: string,
        descriptor?: PropertyDescriptor
    ) {
        // Handle both legacy and modern decorator usage
        if (descriptor) {
            // Legacy decorator usage
            const originalMethod = descriptor.value;

            descriptor.value = async function (...args: any[]) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error) {
                    throw errorFactory(error);
                }
            };

            return descriptor;
        } else {
            // Modern decorator usage - return a method descriptor
            return {
                value: async function (...args: any[]) {
                    try {
                        return await target.apply(this, args);
                    } catch (error) {
                        throw errorFactory(error);
                    }
                },
                writable: true,
                enumerable: false,
                configurable: true,
            };
        }
    };
}
