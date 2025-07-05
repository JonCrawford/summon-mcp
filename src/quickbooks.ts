import OAuthClient from 'intuit-oauth';
import fs from 'fs/promises';
import path from 'path';
import QuickBooks from 'node-quickbooks';

// Token storage path - relative to project root, not cwd
const TOKENS_PATH = path.join(path.dirname(path.dirname(import.meta.url.replace('file://', ''))), 'tokens.json');

// Lazy initialization of OAuth Client
let oauthClient: OAuthClient | null = null;

function getOAuthClient(): OAuthClient {
  if (!oauthClient) {
    // Validate environment variables
    if (!process.env.INTUIT_CLIENT_ID || !process.env.INTUIT_CLIENT_SECRET) {
      throw new Error('Missing required environment variables: INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET');
    }
    
    oauthClient = new OAuthClient({
      clientId: process.env.INTUIT_CLIENT_ID,
      clientSecret: process.env.INTUIT_CLIENT_SECRET,
      environment: 'sandbox', // Use 'production' for live apps
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
    await fs.writeFile(TOKENS_PATH, JSON.stringify(tokenData, null, 2));
    
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
      await fs.access(TOKENS_PATH);
    } catch {
      throw new Error('No tokens found. Please connect to QuickBooks first by visiting /connect');
    }
    
    // Load tokens from file
    const tokenData = JSON.parse(await fs.readFile(TOKENS_PATH, 'utf-8'));
    
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
      await fs.writeFile(TOKENS_PATH, JSON.stringify(tokenData, null, 2));
    }
    
    // Create and return QuickBooks client
    const qbo = new QuickBooks(
      process.env.INTUIT_CLIENT_ID,
      process.env.INTUIT_CLIENT_SECRET,
      tokenData.access_token,
      false, // No token secret for OAuth 2.0
      tokenData.realm_id,
      true, // Use sandbox
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

export { getOAuthClient, TOKENS_PATH };