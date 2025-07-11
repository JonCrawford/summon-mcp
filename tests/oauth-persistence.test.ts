/**
 * Integration test to verify OAuth tokens are immediately visible
 * without server restart
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenStorage, TokenDatabase } from '../src/token-storage.js';
import { TokenManager } from '../src/token-manager.js';
import * as fs from 'fs';
import * as path from 'path';

describe('OAuth Token Persistence Integration', () => {
  const testDir = path.join(process.cwd(), 'test-oauth-persistence');
  let tokenDb: TokenDatabase;
  let tokenStorage: TokenStorage;
  let tokenManager: TokenManager;

  beforeEach(() => {
    // Clean slate
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    
    // Set required OAuth credentials for tests
    process.env.QB_CLIENT_ID = 'test-client-id';
    process.env.QB_CLIENT_SECRET = 'test-client-secret';
    
    // Create instances that will persist throughout the test
    process.env.QB_STORAGE_DIR = testDir;
    tokenDb = new TokenDatabase(testDir);
    tokenStorage = new TokenStorage();
    tokenManager = new TokenManager();
  });

  afterEach(() => {
    tokenDb.close();
    tokenStorage.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    
    // Clean up environment
    delete process.env.QB_CLIENT_ID;
    delete process.env.QB_CLIENT_SECRET;
    delete process.env.QB_STORAGE_DIR;
  });

  it('should immediately see tokens after OAuth save without restart', async () => {
    // Step 1: Verify no companies initially
    console.log('Step 1: Checking initial state...');
    let companies = tokenDb.listCompanies();
    expect(companies).toHaveLength(0);
    
    const hasTokens = await tokenStorage.hasTokens();
    expect(hasTokens).toBe(false);

    // Step 2: Simulate OAuth completion - save tokens
    console.log('Step 2: Simulating OAuth token save...');
    const oauthTokenData = {
      refreshToken: 'oauth-refresh-token-123',
      accessToken: 'oauth-access-token-456',
      expiresAt: Date.now() + 3600000, // 1 hour from now
      realmId: 'oauth-realm-789',
      companyName: 'OAuth Test Company'
    };
    
    await tokenStorage.saveRefreshToken(oauthTokenData);
    console.log('OAuth tokens saved to database');

    // Step 3: Immediately check if tokens are visible (NO RESTART)
    console.log('Step 3: Checking if tokens are immediately visible...');
    
    // Check via TokenDatabase directly
    companies = tokenDb.listCompanies();
    expect(companies).toHaveLength(1);
    expect(companies[0].companyName).toBe('OAuth Test Company');
    expect(companies[0].realmId).toBe('oauth-realm-789');
    
    // Check via TokenStorage
    const loadedToken = await tokenStorage.loadRefreshToken('oauth-realm-789');
    expect(loadedToken).not.toBeNull();
    expect(loadedToken?.refreshToken).toBe('oauth-refresh-token-123');
    expect(loadedToken?.accessToken).toBe('oauth-access-token-456');
    
    // Check via TokenManager
    const companyList = await tokenManager.listCompanies();
    expect(companyList).toHaveLength(1);
    expect(companyList[0]).toBe('OAuth Test Company');

    console.log('✅ Tokens are immediately visible without restart!');
  });

  it('should handle multiple OAuth flows without restart', async () => {
    // Company 1
    console.log('Adding Company 1...');
    await tokenStorage.saveRefreshToken({
      refreshToken: 'company1-refresh',
      accessToken: 'company1-access',
      expiresAt: Date.now() + 3600000,
      realmId: 'realm-1',
      companyName: 'Company One'
    });
    
    let companies = tokenDb.listCompanies();
    expect(companies).toHaveLength(1);
    
    // Company 2 - without restart
    console.log('Adding Company 2...');
    await tokenStorage.saveRefreshToken({
      refreshToken: 'company2-refresh',
      accessToken: 'company2-access',
      expiresAt: Date.now() + 3600000,
      realmId: 'realm-2',
      companyName: 'Company Two'
    });
    
    companies = tokenDb.listCompanies();
    expect(companies).toHaveLength(2);
    
    // Company 3 - without restart
    console.log('Adding Company 3...');
    await tokenStorage.saveRefreshToken({
      refreshToken: 'company3-refresh',
      accessToken: 'company3-access',
      expiresAt: Date.now() + 3600000,
      realmId: 'realm-3',
      companyName: 'Company Three'
    });
    
    companies = tokenDb.listCompanies();
    expect(companies).toHaveLength(3);
    
    // Verify all companies are accessible
    const companyNames = companies.map(c => c.companyName).sort();
    expect(companyNames).toEqual(['Company One', 'Company Three', 'Company Two']);
    
    console.log('✅ All 3 companies visible without any restarts!');
  });

  it('should simulate real OAuth flow with token update', async () => {
    // Initial OAuth
    console.log('Initial OAuth authentication...');
    await tokenManager.saveTokens(
      {
        refresh_token: 'initial-refresh',
        access_token: 'initial-access',
        expires_in: 3600
      },
      'test-realm',
      'Test Business LLC'
    );
    
    // Verify immediately visible
    let companies = await tokenManager.listCompanies();
    expect(companies).toContain('Test Business LLC');
    
    // Simulate token refresh (common OAuth operation)
    console.log('Refreshing token...');
    await tokenManager.saveTokens(
      {
        refresh_token: 'refreshed-token',
        access_token: 'new-access-token',
        expires_in: 3600
      },
      'test-realm',
      'Test Business LLC'
    );
    
    // Verify updated token is immediately visible
    const tokenData = await tokenManager.getTokenData('Test Business LLC');
    expect(tokenData?.refreshToken).toBe('refreshed-token');
    expect(tokenData?.accessToken).toBe('new-access-token');
    
    console.log('✅ Token updates are immediately visible!');
  });
});