/**
 * QuickBooks Multi-Tenant Broker
 * 
 * Handles multiple QuickBooks company connections
 * - Manages tokens for multiple companies
 * - Company-specific API clients
 * - OAuth flow with company selection
 */

import QuickBooks from 'node-quickbooks';
import { TokenManager } from './token-manager.js';
import { TokenStorage } from './token-storage.js';
import { OAuthListener } from './oauth-listener.js';
import { openUrlInBrowser } from './utils/browser-opener.js';
import { getConfig, getRedirectUri } from './config.js';

// Cache of QuickBooks clients by company name
const qbClients = new Map<string, QuickBooks>();

export class QuickBooksBroker {
  private tokenManager: TokenManager;
  private tokenStorage: TokenStorage | null = null;
  private lastUsedCompany: { name: string; realmId: string } | null = null;

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
    // TokenStorage will be initialized lazily to avoid sync sql.js init
  }

  private async getTokenStorage(): Promise<TokenStorage> {
    if (!this.tokenStorage) {
      this.tokenStorage = new TokenStorage();
    }
    return this.tokenStorage;
  }

  /**
   * List all connected companies
   */
  async listCompanies(): Promise<{ name: string; realmId: string }[]> {
    const tokenStorage = await this.getTokenStorage();
    const companyNames = await tokenStorage.listCompanies();
    const companies: { name: string; realmId: string }[] = [];
    
    for (const name of companyNames) {
      const tokenData = await tokenStorage.loadRefreshToken(name);
      if (tokenData?.realmId) {
        companies.push({ name, realmId: tokenData.realmId });
      }
    }
    
    return companies;
  }

  /**
   * Get QuickBooks client for a specific company
   * @param realmId - The realm ID of the company
   */
  async getQBOClient(realmId?: string): Promise<QuickBooks> {
    let companyInfo: { name: string; realmId: string } | undefined;
    
    if (!realmId) {
      // Get first company if none specified
      const companies = await this.listCompanies();
      if (companies.length === 0) {
        throw new Error('No QuickBooks companies connected. Please use the "authenticate" tool first to connect to QuickBooks.');
      }
      if (companies.length > 1) {
        throw new Error(`Multiple QuickBooks companies found. Please specify the realmId parameter. Available companies: ${companies.map(c => `${c.name} (${c.realmId})`).join(', ')}`);
      }
      companyInfo = companies[0];
      realmId = companyInfo.realmId;
    }
    
    // Check cache by realmId
    if (qbClients.has(realmId)) {
      // Update last used company if we have info
      if (companyInfo) {
        this.lastUsedCompany = companyInfo;
      }
      return qbClients.get(realmId)!;
    }
    
    // Load tokens for this company by realmId
    const tokenStorage = await this.getTokenStorage();
    const tokenData = await tokenStorage.loadRefreshToken(realmId);
    if (!tokenData) {
      const companies = await this.listCompanies();
      throw new Error(`Company with realm ID "${realmId}" not found. Available companies: ${companies.map(c => `${c.name} (${c.realmId})`).join(', ')}`);
    }
    
    // If we don't have company info yet, find it
    if (!companyInfo) {
      const companies = await this.listCompanies();
      companyInfo = companies.find(c => c.realmId === realmId);
    }
    
    // Update last used company
    if (companyInfo) {
      this.lastUsedCompany = companyInfo;
    }
    
    // Ensure we have a valid access token
    const accessToken = await this.tokenManager.getAccessToken();
    
    // Get configuration
    const config = getConfig();
    
    // Create client
    const client = new QuickBooks(
      config.clientId,
      config.clientSecret,
      accessToken,
      false, // No token secret for OAuth 2.0
      tokenData.realmId!,
      !config.isProduction, // Use sandbox = true when NOT in production
      false, // Disable debug for MCP stdio transport
      null, // Minor version
      '2.0', // OAuth version
      '' // Refresh token not needed here
    );
    
    // Cache the client by realmId
    qbClients.set(realmId, client);
    
    return client;
  }

  /**
   * Get the last used company info
   */
  getLastUsedCompanyInfo(): { name: string; realmId: string; companyName?: string } | null {
    if (!this.lastUsedCompany) {
      return null;
    }
    return {
      ...this.lastUsedCompany,
      companyName: this.lastUsedCompany.name // Provide both for compatibility
    };
  }

  /**
   * Clear client cache for a company
   */
  clearClientCache(companyName?: string): void {
    if (companyName) {
      qbClients.delete(companyName);
    } else {
      qbClients.clear();
    }
  }

  /**
   * Start OAuth authentication flow
   */
  async authenticate(force?: boolean): Promise<string> {
    // Check if we already have companies
    if (!force) {
      const companies = await this.listCompanies();
      if (companies.length > 0) {
        return `Already connected to ${companies.length} QuickBooks company(s): ${companies.map(c => c.name).join(', ')}. Use force: true to add another company.`;
      }
    }
    
    // OAuth flow works in all environments including DXT
    
    const listener = new OAuthListener();
    
    try {
      console.error('OAuth: Starting OAuth flow...');
      
      // Start the OAuth listener
      const { state } = await listener.start();
      console.error(`OAuth: Listener started on port 9741, state: ${state}`);
      
      // Get configuration
      const config = getConfig();
      
      // Generate auth URL
      const redirectUri = getRedirectUri(config);
      const authUrl = await this.tokenManager.generateAuthUrl(state, redirectUri);
      console.error(`OAuth: Generated auth URL: ${authUrl}`);
      
      // Open browser
      this.openBrowser(authUrl);
      
      // Wait for callback
      console.error('OAuth: Waiting for callback...');
      const result = await listener.waitForCallback();
      console.error(`OAuth: Callback received - code: ${result.code?.substring(0, 10)}..., realmId: ${result.realmId}`);
      
      // Exchange code for tokens
      console.error('OAuth: Exchanging authorization code for tokens...');
      await this.tokenManager.exchangeCodeForTokens(result.code, result.realmId!);
      console.error('OAuth: Token exchange successful!');
      
      // Clear client cache
      this.clearClientCache();
      
      // Get updated company list
      const companies = await this.listCompanies();
      return `Authentication successful! Connected to ${companies.length} QuickBooks company(s): ${companies.map(c => c.name).join(', ')}`;
    } catch (error: any) {
      console.error('OAuth: Flow failed:', error);
      throw new Error(`OAuth flow failed: ${error.message}`);
    }
  }

  /**
   * Disconnect a company or all companies
   */
  async disconnect(companyName?: string): Promise<string> {
    if (companyName) {
      // TODO: Implement single company disconnect
      return 'Single company disconnect not yet implemented. Use clear_auth to disconnect all companies.';
    }
    
    // Clear all tokens
    await this.tokenManager.clearTokens();
    this.clearClientCache();
    
    return 'All QuickBooks companies have been disconnected.';
  }

  /**
   * Open browser for OAuth
   */
  private openBrowser(url: string) {
    openUrlInBrowser(url);
  }
}