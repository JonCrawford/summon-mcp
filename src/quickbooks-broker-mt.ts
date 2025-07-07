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
import { spawn } from 'child_process';
import { platform } from 'os';
import { getConfig, isConfigError, getRedirectUri } from './config.js';

// Cache of QuickBooks clients by company name
const qbClients = new Map<string, QuickBooks>();

export class QuickBooksBroker {
  private tokenManager: TokenManager;
  private tokenStorage: TokenStorage;

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
    this.tokenStorage = new TokenStorage();
  }

  /**
   * List all connected companies
   */
  async listCompanies(): Promise<{ name: string; realmId: string }[]> {
    const companyNames = await this.tokenStorage.listCompanies();
    const companies: { name: string; realmId: string }[] = [];
    
    for (const name of companyNames) {
      const tokenData = await this.tokenStorage.loadRefreshToken(name);
      if (tokenData?.realmId) {
        companies.push({ name, realmId: tokenData.realmId });
      }
    }
    
    return companies;
  }

  /**
   * Get QuickBooks client for a specific company
   */
  async getQBOClient(companyName?: string): Promise<QuickBooks> {
    // Get first company if none specified
    if (!companyName) {
      const companies = await this.listCompanies();
      if (companies.length === 0) {
        throw new Error('No QuickBooks companies connected. Please authenticate first.');
      }
      companyName = companies[0].name;
    }
    
    // Check cache
    if (qbClients.has(companyName)) {
      return qbClients.get(companyName)!;
    }
    
    // Load tokens for this company
    const tokenData = await this.tokenStorage.loadRefreshToken(companyName);
    if (!tokenData) {
      throw new Error(`Company "${companyName}" not found. Available companies: ${(await this.listCompanies()).map(c => c.name).join(', ')}`);
    }
    
    // Ensure we have a valid access token
    const accessToken = await this.tokenManager.getAccessToken();
    
    // Get configuration
    const config = getConfig();
    if (isConfigError(config)) {
      throw new Error(config.message);
    }
    
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
    
    // Cache the client
    qbClients.set(companyName, client);
    
    return client;
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
    
    // In DXT environment, we can't run OAuth flow
    if (process.env.DXT_ENVIRONMENT) {
      return 'OAuth authentication flow cannot be started in DXT environment. Please configure QB_COMPANIES in your Claude Desktop settings with pre-authenticated tokens.';
    }
    
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
      
      // Generate auth URL
      const redirectUri = getRedirectUri(config);
      const authUrl = this.tokenManager.generateAuthUrl(state, redirectUri);
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
}