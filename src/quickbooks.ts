import OAuthClient from 'intuit-oauth';
import fs from 'fs/promises';
import path from 'path';
import QuickBooks from 'node-quickbooks';
import { getConfig, isConfigError, type QuickBooksConfig, type ConfigError } from './config.js';

// Lazy configuration loading
let _configResult: QuickBooksConfig | ConfigError | null = null;

/**
 * Lazily loads and caches the configuration
 */
function getCachedConfig(): QuickBooksConfig | ConfigError {
  if (!_configResult) {
    _configResult = getConfig();
  }
  return _configResult;
}

/**
 * Resets the cached configuration (for testing purposes)
 * @internal
 */
export function __resetConfigCacheForTests(): void {
  _configResult = null;
  oauthClient = null; // Also reset the OAuth client
}

// Token storage path - determined by config
const getTokensPath = () => {
  const configResult = getCachedConfig();
  if (isConfigError(configResult)) {
    // Fallback to sandbox tokens if config error
    return path.join(process.cwd(), 'tokens_sandbox.json');
  }
  return path.join(process.cwd(), configResult.tokenFilePath);
};

// Export for backward compatibility - this needs to be a getter
export const TOKENS_PATH = getTokensPath();

// Lazy initialization of OAuth Client
let oauthClient: OAuthClient | null = null;

function getOAuthClient(): OAuthClient {
  if (!oauthClient) {
    const configResult = getCachedConfig();
    
    // Check if we have valid configuration
    if (isConfigError(configResult)) {
      throw new Error(configResult.message);
    }
    
    const config = configResult as QuickBooksConfig;
    
    oauthClient = new OAuthClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      environment: config.environment,
      redirectUri: 'http://localhost:8080/callback',
      logging: false // Disable logging for Claude Desktop (read-only environment)
    });
  }
  return oauthClient;
}

/**
 * Generate the authorization URL for OAuth flow
 * @returns The Intuit authorization URL
 */
export function getAuthorizeUrl(): string {
  const authUri = getOAuthClient().authorizeUri({
    scope: [
      OAuthClient.scopes.Accounting,
      OAuthClient.scopes.OpenId
    ],
    state: 'quickbooks-mcp-' + Date.now() // Add state for CSRF protection
  });
  
  return authUri;
}

/**
 * Handle OAuth callback and exchange code for tokens
 * @param url The full callback URL with query parameters
 * @returns The token data
 */
export async function handleCallback(url: string): Promise<any> {
  try {
    // Parse the authorization code from the callback URL
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const realmId = urlObj.searchParams.get('realmId'); // Company ID
    
    if (!code) {
      throw new Error('No authorization code found in callback URL');
    }
    
    // Exchange the authorization code for tokens
    const authResponse = await getOAuthClient().createToken(url);
    
    // Prepare token data to save
    const tokenData = {
      access_token: authResponse.access_token,
      refresh_token: authResponse.refresh_token,
      expires_at: Date.now() + (authResponse.expires_in * 1000), // Convert to timestamp
      x_refresh_token_expires_at: Date.now() + (authResponse.x_refresh_token_expires_in * 1000),
      realm_id: realmId,
      created_at: Date.now()
    };
    
    // Save tokens to file
    await fs.writeFile(getTokensPath(), JSON.stringify(tokenData, null, 2));
    
    // Set tokens on the client for immediate use
    getOAuthClient().setToken(authResponse);
    
    return tokenData;
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    throw error;
  }
}

/**
 * Get an authenticated QuickBooks client instance
 * @returns Authenticated QuickBooks client
 */
export async function getQBOClient(): Promise<QuickBooks> {
  try {
    // Check if tokens file exists
    try {
      await fs.access(getTokensPath());
    } catch {
      throw new Error('No tokens found. Please connect to QuickBooks first by visiting /connect');
    }
    
    // Load tokens from file
    const tokenData = JSON.parse(await fs.readFile(getTokensPath(), 'utf-8'));
    
    // Check if access token is expired
    const now = Date.now();
    const isExpired = tokenData.expires_at <= now;
    
    if (isExpired) {
      // Check if refresh token is still valid
      if (tokenData.x_refresh_token_expires_at <= now) {
        throw new Error('Refresh token expired. Please reconnect to QuickBooks by visiting /connect');
      }
      
      // Refresh the access token
      getOAuthClient().setToken({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token
      });
      
      const refreshResponse = await getOAuthClient().refreshUsingToken(tokenData.refresh_token);
      
      // Update token data
      tokenData.access_token = refreshResponse.access_token;
      tokenData.refresh_token = refreshResponse.refresh_token;
      tokenData.expires_at = Date.now() + (refreshResponse.expires_in * 1000);
      tokenData.x_refresh_token_expires_at = Date.now() + (refreshResponse.x_refresh_token_expires_in * 1000);
      
      // Save updated tokens
      await fs.writeFile(getTokensPath(), JSON.stringify(tokenData, null, 2));
    }
    
    const configResult = getCachedConfig();
    
    // Check if we have valid configuration
    if (isConfigError(configResult)) {
      throw new Error(configResult.message);
    }
    
    const config = configResult as QuickBooksConfig;
    
    // Create and return QuickBooks client
    const qbo = new QuickBooks(
      config.clientId,
      config.clientSecret,
      tokenData.access_token,
      false, // No token secret for OAuth 2.0
      tokenData.realm_id,
      !config.isProduction, // Use sandbox = true when NOT in production
      false, // Disable debug - must be false for MCP stdio transport
      null, // Minor version
      '2.0', // OAuth version
      tokenData.refresh_token
    );
    
    return qbo;
  } catch (error) {
    console.error('Error getting QuickBooks client:', error);
    throw error;
  }
}

export { getOAuthClient };