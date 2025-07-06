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
import { OAuthListener } from './oauth-listener.js';
import { spawn } from 'child_process';
import { platform } from 'os';

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
export async function startOAuthFlow(): Promise<{ authUrl: string; message: string }> {
  const tm = getTokenManager();
  const listener = new OAuthListener();
  
  try {
    // Start the OAuth listener
    const { port, state } = await listener.start();
    
    // Generate auth URL with dynamic callback
    const isProduction = process.env.QUICKBOOKS_PRODUCTION === 'true';
    const redirectUri = isProduction
      ? `https://127-0-0-1.sslip.io:${port}/cb`
      : `http://localhost:${port}/cb`;
    
    const authUrl = tm.generateAuthUrl(state, redirectUri);
    
    // Open browser in background
    openBrowser(authUrl);
    
    // Wait for callback
    const result = await listener.waitForCallback();
    
    // Exchange code for tokens
    await tm.exchangeCodeForTokens(result.code, result.realmId!);
    
    // Clear client cache to force recreation with new tokens
    qbClient = null;
    
    return {
      authUrl,
      message: 'Authentication successful! QuickBooks has been connected.'
    };
  } catch (error: any) {
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
  
  const tokenStorage = new (await import('./token-storage.js')).TokenStorage();
  const credentials = tokenStorage.getOAuthCredentials();
  const isProduction = process.env.QUICKBOOKS_PRODUCTION === 'true';
  
  qbClient = new QuickBooks(
    credentials.clientId,
    credentials.clientSecret,
    accessToken,
    false, // No token secret for OAuth 2.0
    metadata.realmId,
    !isProduction, // Use sandbox = true when NOT in production
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
 * Clear all authentication
 */
export async function disconnect(): Promise<void> {
  const tm = getTokenManager();
  await tm.clearTokens();
  qbClient = null;
}