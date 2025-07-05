/**
 * Configuration module for QuickBooks MCP server
 * Handles production/sandbox mode switching and environment validation
 */

export interface QuickBooksConfig {
  isProduction: boolean;
  environment: 'production' | 'sandbox';
  clientId: string;
  clientSecret: string;
  tokenFilePath: string;
}

export interface ConfigError {
  error: string;
  message: string;
  details?: string;
}

/**
 * Get the application configuration
 * Returns either a valid config or an error object (for MCP JSON responses)
 */
export function getConfig(): QuickBooksConfig | ConfigError {
  // Read production mode from environment
  const isProduction = process.env.QUICKBOOKS_PRODUCTION === 'true';
  const environment = isProduction ? 'production' : 'sandbox';
  
  // Read OAuth credentials - check for production-specific credentials first
  let clientId: string | undefined;
  let clientSecret: string | undefined;
  
  if (isProduction) {
    // In production mode, prefer production-specific credentials
    clientId = process.env.INTUIT_CLIENT_ID_PRODUCTION || process.env.INTUIT_CLIENT_ID;
    clientSecret = process.env.INTUIT_CLIENT_SECRET_PRODUCTION || process.env.INTUIT_CLIENT_SECRET;
  } else {
    // In sandbox mode, use regular credentials
    clientId = process.env.INTUIT_CLIENT_ID;
    clientSecret = process.env.INTUIT_CLIENT_SECRET;
  }
  
  // Validate required credentials
  if (!clientId || !clientSecret) {
    const envVarNames = isProduction 
      ? 'INTUIT_CLIENT_ID_PRODUCTION and INTUIT_CLIENT_SECRET_PRODUCTION (or INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET)'
      : 'INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET';
    
    return {
      error: 'CONFIGURATION_ERROR',
      message: `Missing required QuickBooks OAuth credentials for ${environment} mode`,
      details: `Please set ${envVarNames} environment variables`
    };
  }
  
  // Determine token file path based on mode
  const tokenFilePath = isProduction ? 'tokens.json' : 'tokens_sandbox.json';
  
  return {
    isProduction,
    environment,
    clientId,
    clientSecret,
    tokenFilePath
  };
}

/**
 * Type guard to check if the config result is an error
 */
export function isConfigError(config: QuickBooksConfig | ConfigError): config is ConfigError {
  return 'error' in config;
}

/**
 * Get OAuth URLs based on the environment
 */
export function getOAuthUrls(_environment: 'production' | 'sandbox') {
  // QuickBooks OAuth URLs are the same for both environments
  // The environment is specified during OAuth client initialization
  return {
    authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2',
    tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    revokeUrl: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'
  };
}

/**
 * Get QuickBooks API base URL based on environment
 */
export function getApiBaseUrl(environment: 'production' | 'sandbox') {
  return environment === 'production' 
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}