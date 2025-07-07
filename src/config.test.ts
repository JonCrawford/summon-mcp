import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, isConfigError, getOAuthUrls, getApiBaseUrl, getRedirectUri, hasOAuthCredentials } from './config.js';

describe('Configuration Module', () => {
  // Store original env vars
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.QB_PRODUCTION;
    delete process.env.QB_CLIENT_ID;
    delete process.env.QB_CLIENT_SECRET;
    delete process.env.QB_REDIRECT_URI;
    delete process.env.QB_REFRESH_TOKEN;
  });
  
  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv };
  });
  
  describe('getConfig', () => {
    it('should default to sandbox mode when QB_PRODUCTION is not set', () => {
      process.env.QB_CLIENT_ID = 'test_client_id';
      process.env.QB_CLIENT_SECRET = 'test_client_secret';
      
      const config = getConfig();
      
      expect(isConfigError(config)).toBe(false);
      if (!isConfigError(config)) {
        expect(config.isProduction).toBe(false);
        expect(config.environment).toBe('sandbox');
        expect(config.tokenFilePath).toBe('tokens_sandbox.json');
      }
    });
    
    it('should default to sandbox mode when QB_PRODUCTION is not "true"', () => {
      process.env.QB_PRODUCTION = 'false';
      process.env.QB_CLIENT_ID = 'test_client_id';
      process.env.QB_CLIENT_SECRET = 'test_client_secret';
      
      const config = getConfig();
      
      expect(isConfigError(config)).toBe(false);
      if (!isConfigError(config)) {
        expect(config.isProduction).toBe(false);
        expect(config.environment).toBe('sandbox');
      }
    });
    
    it('should use production mode when QB_PRODUCTION is "true"', () => {
      process.env.QB_PRODUCTION = 'true';
      process.env.QB_CLIENT_ID = 'test_client_id';
      process.env.QB_CLIENT_SECRET = 'test_client_secret';
      
      const config = getConfig();
      
      expect(isConfigError(config)).toBe(false);
      if (!isConfigError(config)) {
        expect(config.isProduction).toBe(true);
        expect(config.environment).toBe('production');
        expect(config.tokenFilePath).toBe('tokens.json');
      }
    });
    
    it('should return error when QB_CLIENT_ID is missing', () => {
      process.env.QB_CLIENT_SECRET = 'test_secret';
      
      const config = getConfig();
      
      expect(isConfigError(config)).toBe(true);
      if (isConfigError(config)) {
        expect(config.error).toBe('CONFIGURATION_ERROR');
        expect(config.message).toContain('Missing required QuickBooks OAuth credentials');
        expect(config.details).toContain('QB_CLIENT_ID');
      }
    });
    
    it('should return error when QB_CLIENT_SECRET is missing', () => {
      process.env.QB_CLIENT_ID = 'test_client_id';
      
      const config = getConfig();
      
      expect(isConfigError(config)).toBe(true);
      if (isConfigError(config)) {
        expect(config.error).toBe('CONFIGURATION_ERROR');
        expect(config.message).toContain('Missing required QuickBooks OAuth credentials');
        expect(config.details).toContain('QB_CLIENT_SECRET');
      }
    });
    
    it('should return error when both credentials are missing', () => {
      const config = getConfig();
      
      expect(isConfigError(config)).toBe(true);
      if (isConfigError(config)) {
        expect(config.error).toBe('CONFIGURATION_ERROR');
        expect(config.message).toContain('Missing required QuickBooks OAuth credentials');
      }
    });
    
    it('should include credentials in config when valid', () => {
      process.env.QB_CLIENT_ID = 'my_client_id';
      process.env.QB_CLIENT_SECRET = 'my_client_secret';
      
      const config = getConfig();
      
      expect(isConfigError(config)).toBe(false);
      if (!isConfigError(config)) {
        expect(config.clientId).toBe('my_client_id');
        expect(config.clientSecret).toBe('my_client_secret');
      }
    });

    it('should include optional environment variables when set', () => {
      process.env.QB_CLIENT_ID = 'test_client_id';
      process.env.QB_CLIENT_SECRET = 'test_client_secret';
      process.env.QB_REDIRECT_URI = 'https://custom-redirect.com/cb';
      process.env.QB_REFRESH_TOKEN = 'refresh123';
      
      const config = getConfig();
      
      expect(isConfigError(config)).toBe(false);
      if (!isConfigError(config)) {
        expect(config.redirectUri).toBe('https://custom-redirect.com/cb');
        expect(config.refreshToken).toBe('refresh123');
      }
    });
  });

  describe('getRedirectUri', () => {
    it('should use config redirectUri when provided', () => {
      const config = { redirectUri: 'https://custom.com/callback' };
      const uri = getRedirectUri(config);
      expect(uri).toBe('https://custom.com/callback');
    });

    it('should use environment variable when no config provided', () => {
      process.env.QB_REDIRECT_URI = 'https://env-uri.com/cb';
      const uri = getRedirectUri();
      expect(uri).toBe('https://env-uri.com/cb');
    });

    it('should default to production sslip.io URL when production mode', () => {
      process.env.QB_PRODUCTION = 'true';
      const uri = getRedirectUri();
      expect(uri).toBe('https://127-0-0-1.sslip.io:9741/cb');
    });

    it('should default to localhost URL when sandbox mode', () => {
      process.env.QB_PRODUCTION = 'false';
      const uri = getRedirectUri();
      expect(uri).toBe('http://localhost:9741/cb');
    });

    it('should prefer config over environment', () => {
      process.env.QB_REDIRECT_URI = 'https://env-uri.com/cb';
      const config = { redirectUri: 'https://config-uri.com/cb' };
      const uri = getRedirectUri(config);
      expect(uri).toBe('https://config-uri.com/cb');
    });
  });

  describe('hasOAuthCredentials', () => {
    it('should return true when credentials are available', () => {
      process.env.QB_CLIENT_ID = 'test_client_id';
      process.env.QB_CLIENT_SECRET = 'test_client_secret';
      
      expect(hasOAuthCredentials()).toBe(true);
    });

    it('should return false when credentials are missing', () => {
      expect(hasOAuthCredentials()).toBe(false);
    });

    it('should return false when only client ID is set', () => {
      process.env.QB_CLIENT_ID = 'test_client_id';
      expect(hasOAuthCredentials()).toBe(false);
    });

    it('should return false when only client secret is set', () => {
      process.env.QB_CLIENT_SECRET = 'test_client_secret';
      expect(hasOAuthCredentials()).toBe(false);
    });
  });
  
  describe('isConfigError', () => {
    it('should correctly identify error objects', () => {
      const error = {
        error: 'TEST_ERROR',
        message: 'Test error message'
      };
      
      expect(isConfigError(error)).toBe(true);
    });
    
    it('should correctly identify valid config objects', () => {
      const config = {
        isProduction: false,
        environment: 'sandbox' as const,
        clientId: 'test',
        clientSecret: 'test',
        tokenFilePath: 'tokens_sandbox.json'
      };
      
      expect(isConfigError(config)).toBe(false);
    });
  });
  
  describe('getOAuthUrls', () => {
    it('should return correct OAuth URLs for sandbox', () => {
      const urls = getOAuthUrls('sandbox');
      
      expect(urls.authorizationUrl).toBe('https://appcenter.intuit.com/connect/oauth2');
      expect(urls.tokenUrl).toBe('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer');
      expect(urls.revokeUrl).toBe('https://developer.api.intuit.com/v2/oauth2/tokens/revoke');
    });
    
    it('should return correct OAuth URLs for production', () => {
      const urls = getOAuthUrls('production');
      
      // OAuth URLs are the same for both environments
      expect(urls.authorizationUrl).toBe('https://appcenter.intuit.com/connect/oauth2');
      expect(urls.tokenUrl).toBe('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer');
      expect(urls.revokeUrl).toBe('https://developer.api.intuit.com/v2/oauth2/tokens/revoke');
    });
  });
  
  describe('getApiBaseUrl', () => {
    it('should return sandbox API URL for sandbox environment', () => {
      const url = getApiBaseUrl('sandbox');
      expect(url).toBe('https://sandbox-quickbooks.api.intuit.com');
    });
    
    it('should return production API URL for production environment', () => {
      const url = getApiBaseUrl('production');
      expect(url).toBe('https://quickbooks.api.intuit.com');
    });
  });
});