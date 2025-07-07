/**
 * QuickBooks Broker - Main integration point for MCP tools
 * 
 * Handles:
 * - OAuth authentication flow
 * - Token management
 * - QuickBooks API client creation
 */

import QuickBooks from 'node-quickbooks';
import { TokenManager } from './token-manager.js';
import { TokenData } from './token-storage.js';
import { OAuthListener } from './oauth-listener.js';
import { spawn } from 'child_process';
import { platform } from 'os';
import { getConfig, isConfigError, getRedirectUri } from './config.js';

// Singleton instances
let tokenManager: TokenManager | null = null;
let qbClient: QuickBooks | null = null;

/**
 * Error codes for MCP responses
 */
export enum ErrorCode {
  NEEDS_AUTH = 'QUICKBOOKS_NEEDS_AUTH',
  AUTH_FAILED = 'QUICKBOOKS_AUTH_FAILED',
  TOKEN_EXPIRED = 'QUICKBOOKS_TOKEN_EXPIRED',
  API_ERROR = 'QUICKBOOKS_API_ERROR'
}

/**
 * Initialize token manager
 */
function getTokenManager(): TokenManager {
  if (!tokenManager) {
    tokenManager = new TokenManager();
  }
  return tokenManager;
}

/**
 * Ensure we have valid authentication
 */
export async function ensureAuth(): Promise<boolean> {
  const tm = getTokenManager();
  
  // Check if we have a refresh token
  if (await tm.hasRefreshToken()) {
    try {
      // Try to get access token (will refresh if needed)
      await tm.getAccessToken();
      return true;
    } catch (error: any) {
      // If refresh token is expired, we need to re-auth
      if (error.message.includes('expired')) {
        return false;
      }
      throw error;
    }
  }
  
  return false;
}

/**
 * Start OAuth flow
 */
export async function startOAuthFlow(): Promise<{ authUrl: string; message: string; refreshToken?: string; realmId?: string }> {
  const tm = getTokenManager();
  const listener = new OAuthListener();
  
  try {
    console.error('OAuth: Starting OAuth flow...');
    
    // Start the OAuth listener
    const { state } = await listener.start();
    console.error(`OAuth: Listener started on port 9741, state: ${state}`);
    
    // Get configuration
    const config = getConfig();
    if (isConfigError(config)) {
      throw new Error(config.message);
    }
    
    // Generate auth URL with proper redirect URI
    const redirectUri = getRedirectUri(config);
    
    console.error(`OAuth: Using ${config.environment} mode with redirect URI: ${redirectUri}`);
    
    const authUrl = tm.generateAuthUrl(state, redirectUri);
    console.error(`OAuth: Generated auth URL: ${authUrl}`);
    
    // Open browser in background
    openBrowser(authUrl);
    
    // Wait for callback
    console.error('OAuth: Waiting for callback...');
    const result = await listener.waitForCallback();
    console.error(`OAuth: Callback received - code: ${result.code?.substring(0, 10)}..., realmId: ${result.realmId}`);
    
    // Exchange code for tokens
    console.error('OAuth: Exchanging authorization code for tokens...');
    let tokenData: TokenData | null = null;
    try {
      await tm.exchangeCodeForTokens(result.code, result.realmId!);
      console.error('OAuth: Token exchange successful!');
      
      // Get the saved token data to return to user
      tokenData = await tm.getTokenData();
      
      // Set token data on the listener so it can be served via /tokens endpoint
      if (tokenData) {
        listener.setTokenData({
          refreshToken: tokenData.refreshToken,
          realmId: tokenData.realmId
        });
      }
    } catch (exchangeError: any) {
      console.error('OAuth: Token exchange failed:', exchangeError);
      console.error('OAuth: Error details:', JSON.stringify(exchangeError, null, 2));
      throw exchangeError;
    }
    
    // Clear client cache to force recreation with new tokens
    qbClient = null;
    
    return {
      authUrl,
      message: 'Authentication successful! QuickBooks has been connected.',
      refreshToken: tokenData?.refreshToken,
      realmId: tokenData?.realmId
    };
  } catch (error: any) {
    console.error('OAuth: Flow failed:', error);
    console.error('OAuth: Error stack:', error.stack);
    throw new Error(`OAuth flow failed: ${error.message}`);
  }
}

/**
 * Open browser for OAuth
 */
function openBrowser(url: string) {
  const os = platform();
  let command: string;
  
  switch (os) {
    case 'darwin':
      command = 'open';
      break;
    case 'win32':
      command = 'start';
      break;
    default:
      command = 'xdg-open';
  }
  
  try {
    spawn(command, [url], { detached: true, stdio: 'ignore' }).unref();
  } catch (error) {
    console.error('Failed to open browser:', error);
  }
}

/**
 * Get authenticated QuickBooks client
 */
export async function getQBOClient(): Promise<QuickBooks> {
  // Check if we have valid auth
  if (!(await ensureAuth())) {
    throw new Error(JSON.stringify({
      code: ErrorCode.NEEDS_AUTH,
      message: 'QuickBooks authentication required. Starting OAuth flow...',
      needsAuth: true
    }));
  }
  
  // Return cached client if available
  if (qbClient) {
    return qbClient;
  }
  
  // Create new client
  const tm = getTokenManager();
  const accessToken = await tm.getAccessToken();
  const metadata = await tm.getTokenMetadata();
  
  if (!metadata?.realmId) {
    throw new Error('No QuickBooks company connected');
  }
  
  // Get configuration
  const config = getConfig();
  if (isConfigError(config)) {
    throw new Error(config.message);
  }
  
  qbClient = new QuickBooks(
    config.clientId,
    config.clientSecret,
    accessToken,
    false, // No token secret for OAuth 2.0
    metadata.realmId,
    !config.isProduction, // Use sandbox = true when NOT in production
    false, // Disable debug for MCP stdio transport
    null, // Minor version
    '2.0', // OAuth version
    '' // Refresh token not needed here
  );
  
  return qbClient;
}

/**
 * List connected companies
 */
export async function listCompanies(): Promise<string[]> {
  const tm = getTokenManager();
  const metadata = await tm.getTokenMetadata();
  
  if (!metadata?.companyName) {
    return [];
  }
  
  return [metadata.companyName];
}

/**
 * Clear cached QuickBooks client (forces recreation on next call)
 */
export function clearClientCache(): void {
  qbClient = null;
}

/**
 * Clear all authentication
 */
export async function disconnect(): Promise<void> {
  const tm = getTokenManager();
  await tm.clearTokens();
  qbClient = null;
}