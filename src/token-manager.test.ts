import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenManager } from './token-manager.js';
import { TokenStorage } from './token-storage.js';
import OAuthClient from 'intuit-oauth';

// Store original env vars
const originalEnv = { ...process.env };

// Mock the dependencies
vi.mock('./token-storage.js');
vi.mock('intuit-oauth');

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let mockTokenStorage: any;
  let mockOAuthClient: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.QB_PRODUCTION;
    delete process.env.QB_CLIENT_ID;
    delete process.env.QB_CLIENT_SECRET;
    
    // Set default test credentials
    process.env.QB_CLIENT_ID = 'test-client-id';
    process.env.QB_CLIENT_SECRET = 'test-client-secret';
    
    // Setup TokenStorage mock
    mockTokenStorage = {
      loadRefreshToken: vi.fn(),
      saveRefreshToken: vi.fn(),
      clearTokens: vi.fn(),
      getOAuthCredentials: vi.fn().mockReturnValue({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      }),
      hasOAuthCredentials: vi.fn().mockReturnValue(true)
    };
    
    // Setup OAuthClient mock
    mockOAuthClient = {
      setToken: vi.fn(),
      refreshUsingToken: vi.fn(),
      authorizeUri: vi.fn(),
      createToken: vi.fn()
    };
    
    // Mock the constructors
    vi.mocked(TokenStorage).mockImplementation(() => mockTokenStorage);
    vi.mocked(OAuthClient).mockImplementation(() => mockOAuthClient);
    
    // Create instance
    tokenManager = new TokenManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original environment variables
    process.env = { ...originalEnv };
  });

  describe('hasRefreshToken', () => {
    it('should return true when refresh token exists', async () => {
      mockTokenStorage.loadRefreshToken.mockResolvedValue({
        refreshToken: 'test-refresh-token'
      });

      const result = await tokenManager.hasRefreshToken();
      expect(result).toBe(true);
    });

    it('should return false when no refresh token exists', async () => {
      mockTokenStorage.loadRefreshToken.mockResolvedValue(null);

      const result = await tokenManager.hasRefreshToken();
      expect(result).toBe(false);
    });

    it('should return false when refresh token is empty', async () => {
      mockTokenStorage.loadRefreshToken.mockResolvedValue({
        refreshToken: ''
      });

      const result = await tokenManager.hasRefreshToken();
      expect(result).toBe(false);
    });
  });

  describe('getAccessToken', () => {
    it('should return cached access token when valid', async () => {
      const validToken = {
        refreshToken: 'test-refresh',
        accessToken: 'test-access',
        expiresAt: Date.now() + 3600000 // 1 hour from now
      };
      
      mockTokenStorage.loadRefreshToken.mockResolvedValue(validToken);

      const token1 = await tokenManager.getAccessToken();
      const token2 = await tokenManager.getAccessToken();

      expect(token1).toBe('test-access');
      expect(token2).toBe('test-access');
      expect(mockTokenStorage.loadRefreshToken).toHaveBeenCalledTimes(1); // Only loaded once
    });

    it('should refresh token when access token is expired', async () => {
      const expiredToken = {
        refreshToken: 'test-refresh',
        accessToken: 'old-access',
        expiresAt: Date.now() - 1000 // Expired
      };

      const refreshedResponse = {
        refresh_token: 'new-refresh',
        access_token: 'new-access',
        expires_in: 3600
      };

      mockTokenStorage.loadRefreshToken.mockResolvedValue(expiredToken);
      mockOAuthClient.refreshUsingToken.mockResolvedValue(refreshedResponse);

      const token = await tokenManager.getAccessToken();

      expect(token).toBe('new-access');
      expect(mockOAuthClient.setToken).toHaveBeenCalledWith({
        refresh_token: 'test-refresh',
        access_token: 'old-access'
      });
      expect(mockOAuthClient.refreshUsingToken).toHaveBeenCalledWith('test-refresh');
      expect(mockTokenStorage.saveRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: 'new-refresh',
          accessToken: 'new-access'
        })
      );
    });

    it('should refresh token when access token expires within 5 minute buffer', async () => {
      const soonToExpireToken = {
        refreshToken: 'test-refresh',
        accessToken: 'old-access',
        expiresAt: Date.now() + (4 * 60 * 1000) // 4 minutes from now
      };

      const refreshedResponse = {
        access_token: 'new-access',
        expires_in: 3600
      };

      mockTokenStorage.loadRefreshToken.mockResolvedValue(soonToExpireToken);
      mockOAuthClient.refreshUsingToken.mockResolvedValue(refreshedResponse);

      const token = await tokenManager.getAccessToken();

      expect(token).toBe('new-access');
      expect(mockOAuthClient.refreshUsingToken).toHaveBeenCalled();
    });

    it('should throw error when no refresh token available', async () => {
      mockTokenStorage.loadRefreshToken.mockResolvedValue(null);

      await expect(tokenManager.getAccessToken()).rejects.toThrow(
        'No refresh token available for company "default". Please authenticate first.'
      );
    });

    it('should handle concurrent refresh requests', async () => {
      const expiredToken = {
        refreshToken: 'test-refresh',
        accessToken: 'old-access',
        expiresAt: Date.now() - 1000
      };

      const refreshedResponse = {
        access_token: 'new-access',
        expires_in: 3600
      };

      mockTokenStorage.loadRefreshToken.mockResolvedValue(expiredToken);
      
      // Delay the refresh to simulate network latency
      mockOAuthClient.refreshUsingToken.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(refreshedResponse), 100))
      );

      // Make multiple concurrent requests
      const [token1, token2, token3] = await Promise.all([
        tokenManager.getAccessToken(),
        tokenManager.getAccessToken(),
        tokenManager.getAccessToken()
      ]);

      expect(token1).toBe('new-access');
      expect(token2).toBe('new-access');
      expect(token3).toBe('new-access');
      
      // Should only refresh once
      expect(mockOAuthClient.refreshUsingToken).toHaveBeenCalledTimes(1);
    });

    it('should handle expired refresh token', async () => {
      const tokenData = {
        refreshToken: 'expired-refresh',
        accessToken: 'old-access',
        expiresAt: Date.now() - 1000
      };

      mockTokenStorage.loadRefreshToken.mockResolvedValue(tokenData);
      mockOAuthClient.refreshUsingToken.mockRejectedValue({
        authResponse: {
          response: {
            error: 'invalid_grant'
          }
        }
      });

      await expect(tokenManager.getAccessToken()).rejects.toThrow(
        'Refresh token expired. Please reconnect to QuickBooks.'
      );
      
      expect(mockTokenStorage.clearTokens).toHaveBeenCalled();
    });

    it('should preserve refresh token when Intuit does not rotate it', async () => {
      const tokenData = {
        refreshToken: 'original-refresh',
        accessToken: 'old-access',
        expiresAt: Date.now() - 1000,
        realmId: 'test-realm',
        companyName: 'Test Company'
      };

      const refreshedResponse = {
        access_token: 'new-access',
        expires_in: 3600
        // Note: no refresh_token in response
      };

      mockTokenStorage.loadRefreshToken.mockResolvedValue(tokenData);
      mockOAuthClient.refreshUsingToken.mockResolvedValue(refreshedResponse);

      await tokenManager.getAccessToken();

      expect(mockTokenStorage.saveRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: 'original-refresh', // Original preserved
          accessToken: 'new-access',
          realmId: 'test-realm',
          companyName: 'Test Company'
        })
      );
    });
  });

  describe('saveTokens', () => {
    it('should save token data correctly', async () => {
      const tokenResponse = {
        refresh_token: 'new-refresh',
        access_token: 'new-access',
        expires_in: 3600
      };

      await tokenManager.saveTokens(tokenResponse, 'realm123', 'My Company');

      expect(mockTokenStorage.saveRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: 'new-refresh',
          accessToken: 'new-access',
          realmId: 'realm123',
          companyName: 'My Company'
        })
      );
    });

    it('should use default company name when not provided', async () => {
      const tokenResponse = {
        refresh_token: 'new-refresh',
        access_token: 'new-access',
        expires_in: 3600
      };

      await tokenManager.saveTokens(tokenResponse, 'realm123');

      expect(mockTokenStorage.saveRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: 'QuickBooks Company'
        })
      );
    });

    it('should calculate correct expiry time', async () => {
      const now = Date.now();
      const tokenResponse = {
        refresh_token: 'new-refresh',
        access_token: 'new-access',
        expires_in: 7200 // 2 hours
      };

      await tokenManager.saveTokens(tokenResponse, 'realm123');

      const savedData = mockTokenStorage.saveRefreshToken.mock.calls[0][0];
      expect(savedData.expiresAt).toBeGreaterThanOrEqual(now + 7200000);
      expect(savedData.expiresAt).toBeLessThan(now + 7200000 + 1000); // Allow 1s variance
    });
  });

  describe('getTokenMetadata', () => {
    it('should return metadata when tokens exist', async () => {
      mockTokenStorage.loadRefreshToken.mockResolvedValue({
        refreshToken: 'test-refresh',
        realmId: 'realm123',
        companyName: 'Test Company'
      });

      const metadata = await tokenManager.getTokenMetadata();

      expect(metadata).toEqual({
        realmId: 'realm123',
        companyName: 'Test Company'
      });
    });

    it('should return null when no tokens exist', async () => {
      mockTokenStorage.loadRefreshToken.mockResolvedValue(null);

      const metadata = await tokenManager.getTokenMetadata();

      expect(metadata).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('should clear tokens and reset cache', async () => {
      await tokenManager.clearTokens();

      expect(mockTokenStorage.clearTokens).toHaveBeenCalled();
      
      // Verify cache is cleared by trying to get token after clear
      mockTokenStorage.loadRefreshToken.mockResolvedValue(null);
      await expect(tokenManager.getAccessToken()).rejects.toThrow();
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate auth URL with correct parameters', () => {
      mockOAuthClient.authorizeUri.mockReturnValue('https://auth.url');

      const url = tokenManager.generateAuthUrl('test-state', 'https://redirect.uri');

      expect(mockOAuthClient.authorizeUri).toHaveBeenCalledWith({
        scope: [OAuthClient.scopes.Accounting],
        state: 'test-state'
      });
      expect(url).toBe('https://auth.url');
    });

    it('should use default redirect URI for sandbox', () => {
      process.env.QB_PRODUCTION = 'false';
      
      tokenManager.generateAuthUrl('test-state');

      expect(OAuthClient).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUri: 'http://localhost:9741/cb'
        })
      );
    });

    it('should use sslip.io redirect URI for production', () => {
      process.env.QB_PRODUCTION = 'true';
      
      tokenManager.generateAuthUrl('test-state');

      expect(OAuthClient).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUri: 'https://127-0-0-1.sslip.io:9741/cb'
        })
      );
    });

    it('should throw error when credentials are missing', () => {
      mockTokenStorage.getOAuthCredentials.mockReturnValue({
        clientId: '',
        clientSecret: ''
      });

      expect(() => tokenManager.generateAuthUrl('test-state')).toThrow(
        'OAuth credentials not configured'
      );
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens and save them', async () => {
      const tokenData = {
        refresh_token: 'new-refresh',
        access_token: 'new-access',
        expires_in: 3600
      };

      mockOAuthClient.createToken.mockResolvedValue(tokenData);

      await tokenManager.exchangeCodeForTokens('auth-code', 'realm123');

      expect(mockOAuthClient.createToken).toHaveBeenCalledWith('http://localhost:9741/cb?code=auth-code&realmId=realm123');
      expect(mockTokenStorage.saveRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: 'new-refresh',
          accessToken: 'new-access',
          realmId: 'realm123'
        })
      );
    });

    it('should handle OAuth client errors', async () => {
      mockOAuthClient.createToken.mockRejectedValue(new Error('Invalid authorization code'));

      await expect(
        tokenManager.exchangeCodeForTokens('bad-code', 'realm123')
      ).rejects.toThrow('Invalid authorization code');
    });
  });

  describe('OAuth client initialization', () => {
    it('should reuse OAuth client instance', () => {
      tokenManager.generateAuthUrl('state1');
      tokenManager.generateAuthUrl('state2');

      // Should only create one OAuth client
      expect(OAuthClient).toHaveBeenCalledTimes(1);
    });

    it('should set correct environment based on QB_PRODUCTION', () => {
      process.env.QB_PRODUCTION = 'true';
      tokenManager = new TokenManager();
      
      tokenManager.generateAuthUrl('state');

      expect(OAuthClient).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'production'
        })
      );
    });
  });
});