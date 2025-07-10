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
import { getRedirectUri } from './config.js';
import { ConfigurationError, TokenError, ErrorFactory } from './errors/index.js';

export interface TokenManagerConfig {
  clientId: string;
  clientSecret: string;
  isProduction: boolean;
  redirectUri?: string;
}

// Debug logging - no file writes in DXT
function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ${message}`, data ? data : '');
}

export class TokenManager {
  private tokenStorage: TokenStorage | null = null;
  private oauthClient: OAuthClient | null = null;
  private refreshPromise: Promise<TokenData> | null = null;
  private tokenCache: TokenData | null = null;
  private cacheExpiry: number = 0;

  constructor() {
    // TokenStorage will be initialized lazily to avoid sync sql.js init
  }

  /**
   * Get or initialize TokenStorage
   */
  private async getTokenStorage(): Promise<TokenStorage> {
    if (!this.tokenStorage) {
      this.tokenStorage = new TokenStorage();
    }
    return this.tokenStorage;
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
        redirectUri: getRedirectUri(config),
        logging: false
      });
    }
    return this.oauthClient;
  }

  /**
   * Get configuration from environment
   */
  private async getConfig(): Promise<TokenManagerConfig> {
    const tokenStorage = await this.getTokenStorage();
    const credentials = tokenStorage.getOAuthCredentials();
    if (!credentials.clientId || !credentials.clientSecret) {
      throw new ConfigurationError(
        'OAuth credentials not configured. Please set QB_CLIENT_ID and QB_CLIENT_SECRET.',
        undefined,
        {
          hasClientId: !!credentials.clientId,
          hasClientSecret: !!credentials.clientSecret
        }
      );
    }

    return {
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      isProduction: process.env.QB_PRODUCTION === 'true',
      redirectUri: process.env.QB_REDIRECT_URI
    };
  }

  /**
   * Check if we have a refresh token available
   */
  async hasRefreshToken(companyName?: string): Promise<boolean> {
    const tokenStorage = await this.getTokenStorage();
    const tokenData = await tokenStorage.loadRefreshToken(companyName);
    return !!(tokenData?.refreshToken);
  }

  /**
   * Get valid access token (refreshing if needed)
   */
  async getAccessToken(companyName?: string): Promise<string> {
    // Check cache first (simplified for now - TODO: implement company-specific cache)
    if (this.tokenCache && this.cacheExpiry > Date.now() && this.tokenCache.companyName === companyName) {
      return this.tokenCache.accessToken!;
    }

    // Load token data
    const tokenStorage = await this.getTokenStorage();
    const tokenData = await tokenStorage.loadRefreshToken(companyName);
    if (!tokenData?.refreshToken) {
      throw new TokenError(
        `No refresh token available for company "${companyName || 'default'}". Please authenticate first.`,
        false,
        undefined,
        { companyName }
      );
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
      const config = await this.getConfig();
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
      const tokenStorage = await this.getTokenStorage();
      await tokenStorage.saveRefreshToken(refreshedData);

      // Update cache
      this.tokenCache = refreshedData;
      this.cacheExpiry = refreshedData.expiresAt! - (5 * 60 * 1000);

      return refreshedData;
    } catch (error: any) {
      // Convert OAuth errors to standardized error types
      const standardError = ErrorFactory.fromOAuth(error, 'refresh_token');
      
      // For expired refresh tokens, clear tokens and force re-authentication
      if (error.authResponse?.response?.error === 'invalid_grant') {
        const tokenStorage = await this.getTokenStorage();
        await tokenStorage.clearTokens();
      }
      
      throw standardError;
    }
  }

  /**
   * Save tokens after OAuth callback
   */
  async saveTokens(tokenResponse: any, realmId: string, companyName?: string): Promise<void> {
    console.error('TokenManager.saveTokens: Creating token data...');
    const tokenData: TokenData = {
      refreshToken: tokenResponse.refresh_token,
      accessToken: tokenResponse.access_token,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
      realmId: realmId,
      companyName: companyName || 'QuickBooks Company'
    };
    
    console.error('TokenManager.saveTokens: Token data:', {
      hasRefreshToken: !!tokenData.refreshToken,
      hasAccessToken: !!tokenData.accessToken,
      expiresAt: tokenData.expiresAt ? new Date(tokenData.expiresAt).toISOString() : 'undefined',
      realmId: tokenData.realmId,
      companyName: tokenData.companyName
    });

    console.error('TokenManager.saveTokens: Calling tokenStorage.saveRefreshToken...');
    const tokenStorage = await this.getTokenStorage();
    await tokenStorage.saveRefreshToken(tokenData);
    console.error('TokenManager.saveTokens: Token storage complete');
    
    // Clear cache to force reload
    this.tokenCache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Get full token data (for displaying to user after OAuth)
   */
  async getTokenData(companyName?: string): Promise<TokenData | null> {
    const tokenStorage = await this.getTokenStorage();
    return await tokenStorage.loadRefreshToken(companyName);
  }

  /**
   * Get current token metadata
   */
  async getTokenMetadata(companyName?: string): Promise<{ realmId?: string; companyName?: string } | null> {
    const tokenStorage = await this.getTokenStorage();
    const tokenData = await tokenStorage.loadRefreshToken(companyName);
    if (!tokenData) return null;

    return {
      realmId: tokenData.realmId,
      companyName: tokenData.companyName
    };
  }

  /**
   * List all companies
   */
  async listCompanies(): Promise<string[]> {
    const tokenStorage = await this.getTokenStorage();
    return await tokenStorage.listCompanies();
  }

  /**
   * Clear tokens for a specific company or all companies
   */
  async clearTokens(companyName?: string): Promise<void> {
    const tokenStorage = await this.getTokenStorage();
    await tokenStorage.clearTokens(companyName);
    // Clear cache if it matches the company being cleared
    if (!companyName || this.tokenCache?.companyName === companyName) {
      this.tokenCache = null;
      this.cacheExpiry = 0;
      this.refreshPromise = null;
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  async generateAuthUrl(state: string, redirectUri?: string): Promise<string> {
    const config = await this.getConfig();
    const client = this.initOAuthClient({ ...config, redirectUri });

    return client.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: state
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, realmId: string): Promise<TokenData> {
    debugLog('TokenManager: Starting token exchange...', { 
      codePreview: code.substring(0, 10) + '...', 
      realmId 
    });
    
    const config = await this.getConfig();
    debugLog('TokenManager: Config', {
      clientIdPreview: config.clientId.substring(0, 10) + '...',
      isProduction: config.isProduction
    });
    
    // Use centralized redirect URI configuration
    const redirectUri = getRedirectUri(config);
    
    const client = this.initOAuthClient({ ...config, redirectUri });
    console.error('TokenManager: OAuth client initialized with redirect URI:', redirectUri);

    try {
      // Exchange code for tokens - createToken expects full callback URL
      const callbackUrl = `${redirectUri}?code=${code}&realmId=${realmId}`;
      console.error('TokenManager: Calling createToken with URL:', callbackUrl);
      const authResponse: any = await client.createToken(callbackUrl);
      
      // The intuit-oauth library returns tokens in authResponse.token
      const tokenData = authResponse.token || authResponse;
      
      debugLog('TokenManager: Token response structure', {
        hasToken: !!authResponse.token,
        hasDirectTokens: !!(authResponse.access_token || authResponse.refresh_token),
        tokenKeys: authResponse.token ? Object.keys(authResponse.token) : [],
        directKeys: Object.keys(authResponse)
      });
      
      debugLog('TokenManager: Token data', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        // Log first 20 chars of tokens if they exist
        accessTokenPreview: tokenData.access_token ? tokenData.access_token.substring(0, 20) + '...' : 'missing',
        refreshTokenPreview: tokenData.refresh_token ? tokenData.refresh_token.substring(0, 20) + '...' : 'missing'
      });
      
      // Try to get company name (we'll use default for now)
      let companyName = 'QuickBooks Company';
      
      // Save tokens
      console.error('TokenManager: Saving tokens...');
      await this.saveTokens(tokenData, realmId, companyName);
      console.error('TokenManager: Tokens saved successfully!');
      
      // Return the actual token data that was just saved
      return {
        refreshToken: tokenData.refresh_token,
        accessToken: tokenData.access_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
        realmId: realmId,
        companyName: companyName
      };
    } catch (error: any) {
      debugLog('TokenManager: Token exchange error', {
        message: error.message,
        status: error.authResponse?.response?.status,
        body: error.authResponse?.response?.body,
        data: error.response?.data,
        stack: error.stack
      });
      
      // Convert OAuth errors to standardized error types
      throw ErrorFactory.fromOAuth(error, 'exchange_code_for_tokens');
    }
  }
}