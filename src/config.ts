/**
 * Configuration module for summon server
 * Handles production/sandbox mode switching and environment validation
 */

import os from 'os';
import { ConfigurationError } from './errors/index.js';

export interface QuickBooksConfig {
    isProduction: boolean;
    environment: 'production' | 'sandbox' | 'staging' | 'test';
    clientId: string;
    clientSecret: string;
    redirectUri?: string;
    storageDir: string;
}

export interface ConfigError {
    error: string;
    message: string;
    details?: string;
}

/**
 * Get the application configuration
 * Returns either a valid config or throws ConfigurationError
 */
export function getConfig(): QuickBooksConfig {
    // Read environment configuration
    const nodeEnv = process.env.NODE_ENV;
    const qbProduction = process.env.QB_PRODUCTION === 'true';
    const qbEnvironment = process.env.QB_ENVIRONMENT;

    // Determine environment priority:
    // 1. Explicit QB_ENVIRONMENT setting
    // 2. QB_PRODUCTION flag
    // 3. NODE_ENV inference
    // 4. Default to sandbox
    let environment: 'production' | 'sandbox' | 'staging' | 'test';
    let isProduction: boolean;

    if (qbEnvironment) {
        environment = qbEnvironment as
            | 'production'
            | 'sandbox'
            | 'staging'
            | 'test';
        isProduction = environment === 'production';
    } else if (qbProduction) {
        environment = 'production';
        isProduction = true;
    } else if (nodeEnv === 'production') {
        // NODE_ENV=production should use staging environment for QuickBooks
        // This ensures we test with sandbox API in staging deployments
        environment = 'staging';
        isProduction = false;
    } else {
        // Default to sandbox for development and testing
        environment = 'sandbox';
        isProduction = false;
    }

    // Read OAuth credentials with fallback support for legacy INTUIT_* variables
    // Priority: QB_* > INTUIT_* > Production-specific variants
    let clientId: string | undefined;
    let clientSecret: string | undefined;
    
    // In DXT mode, credentials are always passed as QB_CLIENT_ID/QB_CLIENT_SECRET
    const isDXT = process.env.DXT_ENVIRONMENT === 'true';
    
    // Debug logging for Windows
    if (isDXT) {
        console.error('Config: DXT mode detected');
        console.error('Config: Environment variables:', {
            QB_CLIENT_ID: process.env.QB_CLIENT_ID ? 'SET' : 'NOT SET',
            QB_CLIENT_SECRET: process.env.QB_CLIENT_SECRET ? 'SET' : 'NOT SET',
            QB_PRODUCTION: process.env.QB_PRODUCTION,
            DXT_ENVIRONMENT: process.env.DXT_ENVIRONMENT,
            // Log all QB_ prefixed env vars
            allQBVars: Object.keys(process.env).filter(key => key.startsWith('QB_')).sort()
        });
    }
    
    if (isDXT) {
        // DXT always uses standard credential names
        clientId = process.env.QB_CLIENT_ID;
        clientSecret = process.env.QB_CLIENT_SECRET;
    } else if (isProduction) {
        // In production (non-DXT), check production-specific credentials first
        clientId = process.env.QB_CLIENT_ID_PRODUCTION || 
                   process.env.INTUIT_CLIENT_ID_PRODUCTION ||
                   process.env.QB_CLIENT_ID || 
                   process.env.INTUIT_CLIENT_ID;
        clientSecret = process.env.QB_CLIENT_SECRET_PRODUCTION || 
                       process.env.INTUIT_CLIENT_SECRET_PRODUCTION ||
                       process.env.QB_CLIENT_SECRET || 
                       process.env.INTUIT_CLIENT_SECRET;
    } else {
        // In sandbox/staging, use standard credentials
        clientId = process.env.QB_CLIENT_ID || 
                   process.env.INTUIT_CLIENT_ID;
        clientSecret = process.env.QB_CLIENT_SECRET || 
                       process.env.INTUIT_CLIENT_SECRET;
    }
    
    const redirectUri = process.env.QB_REDIRECT_URI || process.env.INTUIT_REDIRECT_URI;

    // Read storage directory (defaults to home directory)
    const storageDir = process.env.QB_STORAGE_DIR || os.homedir();

    // Validate required credentials
    if (!clientId || !clientSecret) {
        const credentialSuffix = isProduction ? '_PRODUCTION' : '';
        throw new ConfigurationError(
            `Missing required QuickBooks OAuth credentials for ${environment} mode`,
            undefined,
            {
                details: isProduction
                    ? `Please set QB_CLIENT_ID${credentialSuffix} and QB_CLIENT_SECRET${credentialSuffix} (or INTUIT_CLIENT_ID${credentialSuffix} and INTUIT_CLIENT_SECRET${credentialSuffix}) environment variables`
                    : 'Please set QB_CLIENT_ID and QB_CLIENT_SECRET (or INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET) environment variables',
                environment,
                hasClientId: !!clientId,
                hasClientSecret: !!clientSecret,
            }
        );
    }

    return {
        isProduction,
        environment,
        clientId,
        clientSecret,
        redirectUri,
        storageDir,
    };
}

/**
 * Type guard to check if the config result is an error
 * @deprecated Use try/catch with ConfigurationError instead
 */
export function isConfigError(
    config: QuickBooksConfig | ConfigError
): config is ConfigError {
    return 'error' in config;
}

/**
 * Get configuration with error handling
 * Returns either a valid config or an error object (for backward compatibility)
 */
export function getConfigSafe(): QuickBooksConfig | ConfigError {
    try {
        return getConfig();
    } catch (error) {
        if (error instanceof ConfigurationError) {
            return {
                error: error.errorCode,
                message: error.message,
                details: error.metadata?.details,
            };
        }
        return {
            error: 'CONFIGURATION_ERROR',
            message:
                error instanceof Error
                    ? error.message
                    : 'Unknown configuration error',
            details: 'Please check your environment configuration',
        };
    }
}

/**
 * Get configuration for operations that require credentials
 * In DXT mode, this might retry to handle timing issues
 */
export function getConfigForOperation(): QuickBooksConfig {
    // First attempt
    try {
        return getConfig();
    } catch (error) {
        // In DXT mode, credentials might become available after initial startup
        if (process.env.DXT_ENVIRONMENT === 'true') {
            // Log the issue
            console.error('Config: First attempt failed in DXT mode, checking again...');
            
            // Force a fresh read of environment variables
            const clientId = process.env.QB_CLIENT_ID;
            const clientSecret = process.env.QB_CLIENT_SECRET;
            
            console.error('Config: Fresh read - QB_CLIENT_ID:', clientId ? 'SET' : 'NOT SET');
            console.error('Config: Fresh read - QB_CLIENT_SECRET:', clientSecret ? 'SET' : 'NOT SET');
            
            // Try one more time
            return getConfig();
        }
        // Re-throw in non-DXT environments
        throw error;
    }
}

/**
 * Get OAuth URLs based on the environment
 */
export function getOAuthUrls(
    _environment: 'production' | 'sandbox' | 'staging'
) {
    // QuickBooks OAuth URLs are the same for all environments
    // The environment is specified during OAuth client initialization
    return {
        authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2',
        tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        revokeUrl: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
    };
}

/**
 * Get QuickBooks API base URL based on environment
 */
export function getApiBaseUrl(
    environment: 'production' | 'sandbox' | 'staging'
) {
    return environment === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';
}

/**
 * Get the OAuth redirect URI with proper fallback
 */
export function getRedirectUri(
    config?: Partial<QuickBooksConfig>,
    port?: number
): string {
    // Use configured redirect URI if provided
    if (config?.redirectUri) {
        return config.redirectUri;
    }

    // Check environment variable (handle DXT template substitution failure)
    if (process.env.QB_REDIRECT_URI) {
        if (process.env.QB_REDIRECT_URI.includes('${user_config')) {
            console.error(
                `Warning: DXT template substitution failed for QB_REDIRECT_URI: ${process.env.QB_REDIRECT_URI}`
            );
            console.error(
                'Using default redirect URI instead. Please configure qb_redirect_uri in your DXT settings.'
            );
        } else {
            return process.env.QB_REDIRECT_URI;
        }
    }

    // Use default based on production mode with dynamic port
    const isProduction =
        config?.isProduction ?? process.env.QB_PRODUCTION === 'true';
    const oauthPort = port || 9741; // Default to 9741 if no port specified

    return isProduction
        ? `https://127-0-0-1.sslip.io:${oauthPort}/cb`
        : `http://localhost:${oauthPort}/cb`;
}

/**
 * Check if OAuth credentials are available
 */
export function hasOAuthCredentials(): boolean {
    try {
        getConfig();
        return true;
    } catch (error) {
        return false;
    }
}
