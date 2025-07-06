/**
 * Token Manager - Handles OAuth token lifecycle
 * 
 * Features:
 * - Automatic token refresh before expiration
 * - Multiple storage backends (file, env, DXT)
 * - Handles Intuit's rotating refresh tokens
 * - Thread-safe token operations
 */

import { TokenStorage, TokenData } from './token-storage.js';
import OAuthClient from 'intuit-oauth';

export interface TokenManagerConfig {
  clientId: string;
  clientSecret: string;
  isProduction: boolean;
  redirectUri?: string;
}

export class TokenManager {
  private tokenStorage: TokenStorage;
  private oauthClient: OAuthClient | null = null;
  private refreshPromise: Promise<TokenData> | null = null;
  private tokenCache: TokenData | null = null;
  private cacheExpiry: number = 0;

  constructor() {
    this.tokenStorage = new TokenStorage();
  }

  /**
   * Initialize OAuth client
   */
  private initOAuthClient(config: TokenManagerConfig): OAuthClient {
    if (!this.oauthClient) {
      this.oauthClient = new OAuthClient({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        environment: config.isProduction ? 'production' : 'sandbox',
        redirectUri: config.redirectUri || (config.isProduction 
          ? 'https://127-0-0-1.sslip.io/cb'
          : 'http://localhost:8080/cb'),
        logging: false
      });
    }
    return this.oauthClient;
  }

  /**
   * Get configuration from environment
   */
  private getConfig(): TokenManagerConfig {
    const credentials = this.tokenStorage.getOAuthCredentials();
    if (!credentials.clientId || !credentials.clientSecret) {
      throw new Error('OAuth credentials not configured. Please set QB_CLIENT_ID and QB_CLIENT_SECRET.');
    }

    return {
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      isProduction: process.env.QUICKBOOKS_PRODUCTION === 'true'
    };
  }

  /**
   * Check if we have a refresh token available
   */
  async hasRefreshToken(): Promise<boolean> {
    const tokenData = await this.tokenStorage.loadRefreshToken();
    return !!(tokenData?.refreshToken);
  }

  /**
   * Get valid access token (refreshing if needed)
   */
  async getAccessToken(): Promise<string> {
    // Check cache first
    if (this.tokenCache && this.cacheExpiry > Date.now()) {
      return this.tokenCache.accessToken!;
    }

    // Load token data
    const tokenData = await this.tokenStorage.loadRefreshToken();
    if (!tokenData?.refreshToken) {
      throw new Error('No refresh token available. Please authenticate first.');
    }

    // Check if access token is still valid (with 5 min buffer)
    const now = Date.now();
    const buffer = 5 * 60 * 1000; // 5 minutes
    
    if (tokenData.accessToken && tokenData.expiresAt && tokenData.expiresAt > now + buffer) {
      // Cache the valid token
      this.tokenCache = tokenData;
      this.cacheExpiry = tokenData.expiresAt - buffer;
      return tokenData.accessToken;
    }

    // Need to refresh - ensure we only do this once
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken(tokenData);
    }

    try {
      const refreshedData = await this.refreshPromise;
      return refreshedData.accessToken!;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(tokenData: TokenData): Promise<TokenData> {
    try {
      const config = this.getConfig();
      const client = this.initOAuthClient(config);

      // Set current tokens on client
      client.setToken({
        refresh_token: tokenData.refreshToken,
        access_token: tokenData.accessToken || ''
      });

      // Refresh the token
      const response = await client.refreshUsingToken(tokenData.refreshToken);
      
      // Extract token data from response
      const refreshedData: TokenData = {
        refreshToken: response.refresh_token || tokenData.refreshToken, // Intuit may rotate
        accessToken: response.access_token,
        expiresAt: Date.now() + (response.expires_in * 1000),
        realmId: tokenData.realmId,
        companyName: tokenData.companyName
      };

      // Save the refreshed tokens
      await this.tokenStorage.saveRefreshToken(refreshedData);

      // Update cache
      this.tokenCache = refreshedData;
      this.cacheExpiry = refreshedData.expiresAt! - (5 * 60 * 1000);

      return refreshedData;
    } catch (error: any) {
      // Check if refresh token is expired
      if (error.authResponse?.response?.error === 'invalid_grant') {
        // Clear tokens and force re-authentication
        await this.tokenStorage.clearTokens();
        throw new Error('Refresh token expired. Please reconnect to QuickBooks.');
      }
      throw error;
    }
  }

  /**
   * Save tokens after OAuth callback
   */
  async saveTokens(tokenResponse: any, realmId: string, companyName?: string): Promise<void> {
    const tokenData: TokenData = {
      refreshToken: tokenResponse.refresh_token,
      accessToken: tokenResponse.access_token,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
      realmId: realmId,
      companyName: companyName || 'QuickBooks Company'
    };

    await this.tokenStorage.saveRefreshToken(tokenData);
    
    // Clear cache to force reload
    this.tokenCache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Get current token metadata
   */
  async getTokenMetadata(): Promise<{ realmId?: string; companyName?: string } | null> {
    const tokenData = await this.tokenStorage.loadRefreshToken();
    if (!tokenData) return null;

    return {
      realmId: tokenData.realmId,
      companyName: tokenData.companyName
    };
  }

  /**
   * Clear all tokens
   */
  async clearTokens(): Promise<void> {
    await this.tokenStorage.clearTokens();
    this.tokenCache = null;
    this.cacheExpiry = 0;
    this.refreshPromise = null;
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(state: string, redirectUri?: string): string {
    const config = this.getConfig();
    const client = this.initOAuthClient({ ...config, redirectUri });

    return client.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: state
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, realmId: string): Promise<void> {
    const config = this.getConfig();
    const client = this.initOAuthClient(config);

    // Exchange code for tokens
    const tokenData = await client.createToken(code);
    
    // Try to get company name (we'll use default for now)
    let companyName = 'QuickBooks Company';
    
    // Save tokens
    await this.saveTokens(tokenData, realmId, companyName);
  }
}