import OAuthClient from 'intuit-oauth';
import QuickBooks from 'node-quickbooks';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple file logger for debugging
const logFile = path.resolve(__dirname, '../quickbooks-debug.log');
const debugLog = (message: string) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
};

// --- START MULTI-TENANT CONFIGURATION ---

interface TenantConfig {
  clientId: string;
  clientSecret: string;
  realmId: string;
  refreshToken: string;
  accessToken: string;
  tokenExpiry: number; // Store as timestamp
}

const tenants: Record<string, TenantConfig> = {
  '2nd-in-Command Academy, LLC': {
    clientId: 'ABRlxZcZnmwYNGFoi1MopMid2ac7sgAm6UNN8D46dxQb5yKch8',
    clientSecret: 'BIZNbkZ8B8kwWxGl3SX8Cwr0t0osNRSgO0pw5mxx',
    realmId: '9341454914780836',
    refreshToken: 'RT1-8-H0-1760504689krilm06wlt8ep98lsqok',
    accessToken: '', // Will be populated on first use
    tokenExpiry: 0,
  },
  'Revive Roof LLC': {
    clientId: 'ABRlxZcZnmwYNGFoi1MopMid2ac7sgAm6UNN8D46dxQb5yKch8',
    clientSecret: 'BIZNbkZ8B8kwWxGl3SX8Cwr0t0osNRSgO0pw5mxx',
    realmId: '9341454254881495',
    refreshToken: 'RT1-232-H0-17605049005taiixj6agnyyh8s1q8q',
    accessToken: '', // Will be populated on first use
    tokenExpiry: 0,
  },
};

const IS_PRODUCTION = true; // Using production tokens

// --- END MULTI-TENANT CONFIGURATION ---

function getOAuthClient(companyName: string): OAuthClient {
    const tenant = tenants[companyName];
    if (!tenant) {
        throw new Error(`Company '${companyName}' not configured.`);
    }

    return new OAuthClient({
      clientId: tenant.clientId,
      clientSecret: tenant.clientSecret,
      environment: IS_PRODUCTION ? 'production' : 'sandbox',
      redirectUri: 'http://localhost:3000/callback',
      logging: false
    });
}


/**
 * Get an authenticated QuickBooks client instance
 * @returns Authenticated QuickBooks client
 */
export async function getQBOClient(companyName?: string): Promise<QuickBooks> {
  try {
    const tenantName = companyName || Object.keys(tenants)[0];
    if (!tenantName || !tenants[tenantName]) {
        throw new Error(`Company '${tenantName}' not configured or no default company available.`);
    }

    const tenant = tenants[tenantName];
    
    // Check if access token is expired
    const now = Date.now();
    const isExpired = tenant.tokenExpiry <= now;
    
    if (isExpired) {
      debugLog(`Token expired for ${tenantName}, refreshing...`);
      try {
        const client = getOAuthClient(tenantName);
        const refreshResponse = await client.refreshUsingToken(tenant.refreshToken);
        
        // Don't log the full refresh response as it may contain circular references
        // Just log that we refreshed successfully
        // Log the keys of the refresh response to understand its structure
        debugLog(`Refresh response keys: ${Object.keys(refreshResponse).join(', ')}`);
        
        // The intuit-oauth library returns the token data in a different structure
        const tokenData = (refreshResponse as any).token || (refreshResponse as any).json || refreshResponse;
        debugLog(`Token data keys: ${Object.keys(tokenData).join(', ')}`);
        debugLog(`Access token from tokenData: ${tokenData.access_token?.substring(0, 20)}...`);
        
        tenant.accessToken = tokenData.access_token;
        tenant.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
        debugLog(`Set token for ${tenantName}, new token length: ${tenant.accessToken?.length || 0}`);
      } catch (refreshError) {
        debugLog(`Failed to refresh token for ${tenantName}: ${refreshError instanceof Error ? refreshError.message : JSON.stringify(refreshError)}`);
        throw new Error(`Token refresh failed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`);
      }
    }
    
    // Create and return QuickBooks client
    debugLog(`Creating QB client for ${tenantName} with token length: ${tenant.accessToken?.length || 0}`);
    const qbo = new QuickBooks(
      tenant.clientId,
      tenant.clientSecret,
      tenant.accessToken,
      false, // No token secret for OAuth 2.0
      tenant.realmId,
      !IS_PRODUCTION, // Use sandbox = true when NOT in production
      false, // Disable debug - must be false for MCP stdio transport
      null, // Minor version
      '2.0', // OAuth version
      tenant.refreshToken
    );
    
    return qbo;
  } catch (error) {
    console.error('Error getting QuickBooks client:', error);
    throw error;
  }
}

export function listCompanies(): string[] {
    return Object.keys(tenants);
}