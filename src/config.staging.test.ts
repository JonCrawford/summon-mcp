/**
 * Test for staging environment configuration
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, getApiBaseUrl } from './config.js';

describe('Staging Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset to clean state
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should use staging environment when NODE_ENV=production but QB_PRODUCTION not set', () => {
    process.env.NODE_ENV = 'production';
    process.env.QB_CLIENT_ID = 'test_client_id';
    process.env.QB_CLIENT_SECRET = 'test_client_secret';
    // QB_PRODUCTION not set - should default to staging

    const config = getConfig();
    
    expect(config).not.toHaveProperty('error');
    if ('environment' in config) {
      expect(config.environment).toBe('staging');
      expect(config.isProduction).toBe(false);
    }
  });

  it('should use production environment when QB_PRODUCTION=true regardless of NODE_ENV', () => {
    process.env.NODE_ENV = 'production';
    process.env.QB_PRODUCTION = 'true';
    process.env.QB_CLIENT_ID = 'test_client_id';
    process.env.QB_CLIENT_SECRET = 'test_client_secret';

    const config = getConfig();
    
    expect(config).not.toHaveProperty('error');
    if ('environment' in config) {
      expect(config.environment).toBe('production');
      expect(config.isProduction).toBe(true);
    }
  });

  it('should use explicit QB_ENVIRONMENT setting when provided', () => {
    process.env.NODE_ENV = 'production';
    process.env.QB_ENVIRONMENT = 'sandbox';
    process.env.QB_CLIENT_ID = 'test_client_id';
    process.env.QB_CLIENT_SECRET = 'test_client_secret';

    const config = getConfig();
    
    expect(config).not.toHaveProperty('error');
    if ('environment' in config) {
      expect(config.environment).toBe('sandbox');
      expect(config.isProduction).toBe(false);
    }
  });

  it('should use sandbox API URL for staging environment', () => {
    const productionUrl = getApiBaseUrl('production');
    const stagingUrl = getApiBaseUrl('staging');
    const sandboxUrl = getApiBaseUrl('sandbox');

    expect(productionUrl).toBe('https://quickbooks.api.intuit.com');
    expect(stagingUrl).toBe('https://sandbox-quickbooks.api.intuit.com');
    expect(sandboxUrl).toBe('https://sandbox-quickbooks.api.intuit.com');
  });

  it('should default to sandbox for development', () => {
    process.env.NODE_ENV = 'development';
    process.env.QB_CLIENT_ID = 'test_client_id';
    process.env.QB_CLIENT_SECRET = 'test_client_secret';

    const config = getConfig();
    
    expect(config).not.toHaveProperty('error');
    if ('environment' in config) {
      expect(config.environment).toBe('sandbox');
      expect(config.isProduction).toBe(false);
    }
  });

  it('should default to sandbox when no NODE_ENV is set', () => {
    delete process.env.NODE_ENV;
    process.env.QB_CLIENT_ID = 'test_client_id';
    process.env.QB_CLIENT_SECRET = 'test_client_secret';

    const config = getConfig();
    
    expect(config).not.toHaveProperty('error');
    if ('environment' in config) {
      expect(config.environment).toBe('sandbox');
      expect(config.isProduction).toBe(false);
    }
  });
});