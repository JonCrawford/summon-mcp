import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenStorage } from './token-storage.js';
import { TokenDatabase } from './token-database.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Test data
const testToken1 = {
  refreshToken: 'refresh-token-1',
  accessToken: 'access-token-1',
  expiresAt: Date.now() + 3600000,
  realmId: 'realm-1',
  companyName: 'XYZ Roofing Company'
};

const testToken2 = {
  refreshToken: 'refresh-token-2',
  accessToken: 'access-token-2',
  expiresAt: Date.now() + 3600000,
  realmId: 'realm-2',
  companyName: 'Military Academics LTD'
};

describe('TokenStorage', () => {
  let storage: TokenStorage;
  const testDir = path.join(os.tmpdir(), 'summon-test-' + Date.now());
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set test storage directory
    process.env.QB_STORAGE_DIR = testDir;
    
    // Set test OAuth credentials (required by config)
    process.env.QB_CLIENT_ID = 'test-client-id';
    process.env.QB_CLIENT_SECRET = 'test-client-secret';
    
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    storage = new TokenStorage();
  });

  afterEach(() => {
    // Clean up
    storage.close();
    
    // Remove test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    
    // Restore environment
    process.env = { ...originalEnv };
  });

  describe('saveRefreshToken', () => {
    it('should save a token with all fields', async () => {
      await storage.saveRefreshToken(testToken1);
      
      const loaded = await storage.loadRefreshToken('realm-1');
      expect(loaded).toEqual(testToken1);
    });

    it('should require realmId', async () => {
      const tokenWithoutRealm = { ...testToken1, realmId: undefined };
      
      await expect(storage.saveRefreshToken(tokenWithoutRealm))
        .rejects.toThrow('realmId is required');
    });

    it('should use default company name when not provided', async () => {
      const tokenWithoutName = { ...testToken1, companyName: undefined };
      
      await storage.saveRefreshToken(tokenWithoutName);
      
      const loaded = await storage.loadRefreshToken('realm-1');
      expect(loaded?.companyName).toBe('QuickBooks Company');
    });

    it('should update existing token for same realmId', async () => {
      await storage.saveRefreshToken(testToken1);
      
      const updatedToken = {
        ...testToken1,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      };
      
      await storage.saveRefreshToken(updatedToken);
      
      const loaded = await storage.loadRefreshToken('realm-1');
      expect(loaded?.accessToken).toBe('new-access-token');
      expect(loaded?.refreshToken).toBe('new-refresh-token');
    });
  });

  describe('loadRefreshToken', () => {
    it('should load token by realmId', async () => {
      await storage.saveRefreshToken(testToken1);
      
      const loaded = await storage.loadRefreshToken('realm-1');
      expect(loaded).toEqual(testToken1);
    });

    it('should load token by company name', async () => {
      await storage.saveRefreshToken(testToken1);
      
      const loaded = await storage.loadRefreshToken('XYZ Roofing Company');
      expect(loaded).toEqual(testToken1);
    });

    it('should require exact company name match', async () => {
      await storage.saveRefreshToken(testToken1);
      
      // Should NOT find "XYZ Roofing Company" when searching for "roofing" 
      // LLM will use qb_list_companies to get exact names
      const loaded = await storage.loadRefreshToken('roofing');
      expect(loaded).toBeNull();
      
      // Should find with exact name
      const exactMatch = await storage.loadRefreshToken('XYZ Roofing Company');
      expect(exactMatch).toEqual(testToken1);
    });

    it('should return null for non-existent token', async () => {
      const loaded = await storage.loadRefreshToken('non-existent');
      expect(loaded).toBeNull();
    });

    it('should return first token when no parameter provided', async () => {
      await storage.saveRefreshToken(testToken1);
      await storage.saveRefreshToken(testToken2);
      
      const loaded = await storage.loadRefreshToken();
      expect(loaded?.realmId).toMatch(/^realm-[12]$/);
    });
  });

  describe('clearTokens', () => {
    it('should clear specific token by realmId', async () => {
      await storage.saveRefreshToken(testToken1);
      await storage.saveRefreshToken(testToken2);
      
      await storage.clearTokens('realm-1');
      
      const loaded1 = await storage.loadRefreshToken('realm-1');
      const loaded2 = await storage.loadRefreshToken('realm-2');
      
      expect(loaded1).toBeNull();
      expect(loaded2).toEqual(testToken2);
    });

    it('should clear specific token by company name', async () => {
      await storage.saveRefreshToken(testToken1);
      await storage.saveRefreshToken(testToken2);
      
      await storage.clearTokens('Military Academics LTD');
      
      const loaded1 = await storage.loadRefreshToken('realm-1');
      const loaded2 = await storage.loadRefreshToken('realm-2');
      
      expect(loaded1).toEqual(testToken1);
      expect(loaded2).toBeNull();
    });

    it('should clear all tokens when no parameter provided', async () => {
      await storage.saveRefreshToken(testToken1);
      await storage.saveRefreshToken(testToken2);
      
      await storage.clearTokens();
      
      const hasTokens = await storage.hasTokens();
      expect(hasTokens).toBe(false);
    });
  });

  describe('listCompanies', () => {
    it('should return empty array when no companies', async () => {
      const companies = await storage.listCompanies();
      expect(companies).toEqual([]);
    });

    it('should list all company names', async () => {
      await storage.saveRefreshToken(testToken1);
      await storage.saveRefreshToken(testToken2);
      
      const companies = await storage.listCompanies();
      
      expect(companies).toHaveLength(2);
      expect(companies).toContain('XYZ Roofing Company');
      expect(companies).toContain('Military Academics LTD');
    });
  });

  describe('getCompanyInfo', () => {
    it('should return detailed company information', async () => {
      await storage.saveRefreshToken(testToken1);
      await storage.saveRefreshToken(testToken2);
      
      const info = await storage.getCompanyInfo();
      
      expect(info).toHaveLength(2);
      expect(info).toContainEqual({
        realmId: 'realm-1',
        companyName: 'XYZ Roofing Company'
      });
      expect(info).toContainEqual({
        realmId: 'realm-2',
        companyName: 'Military Academics LTD'
      });
    });
  });

  describe('hasTokens', () => {
    it('should return false when no tokens', async () => {
      const hasTokens = await storage.hasTokens();
      expect(hasTokens).toBe(false);
    });

    it('should return true when tokens exist', async () => {
      await storage.saveRefreshToken(testToken1);
      
      const hasTokens = await storage.hasTokens();
      expect(hasTokens).toBe(true);
    });
  });

  describe('OAuth credentials', () => {
    it('should check for OAuth credentials in environment', () => {
      process.env.QB_CLIENT_ID = 'test-client-id';
      process.env.QB_CLIENT_SECRET = 'test-client-secret';
      
      expect(storage.hasOAuthCredentials()).toBe(true);
    });

    it('should return false when credentials missing', () => {
      delete process.env.QB_CLIENT_ID;
      delete process.env.QB_CLIENT_SECRET;
      
      expect(storage.hasOAuthCredentials()).toBe(false);
    });

    it('should get OAuth credentials from environment', () => {
      process.env.QB_CLIENT_ID = 'test-client-id';
      process.env.QB_CLIENT_SECRET = 'test-client-secret';
      
      const creds = storage.getOAuthCredentials();
      
      expect(creds).toEqual({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      });
    });
  });

  describe('multi-environment support', () => {
    it('should isolate sandbox and production tokens', async () => {
      // Save sandbox token
      process.env.QB_PRODUCTION = 'false';
      const sandboxStorage = new TokenStorage();
      await sandboxStorage.saveRefreshToken({
        ...testToken1,
        companyName: 'Sandbox Company'
      });
      sandboxStorage.close();
      
      // Save production token
      process.env.QB_PRODUCTION = 'true';
      const prodStorage = new TokenStorage();
      await prodStorage.saveRefreshToken({
        ...testToken2,
        companyName: 'Production Company'
      });
      
      // Verify isolation
      const prodCompanies = await prodStorage.listCompanies();
      expect(prodCompanies).toEqual(['Production Company']);
      expect(prodCompanies).not.toContain('Sandbox Company');
      
      prodStorage.close();
    });
  });
});

describe('TokenDatabase', () => {
  const testDir = path.join(os.tmpdir(), 'summon-db-test-' + Date.now());
  let db: TokenDatabase;

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    db = new TokenDatabase(testDir);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('database operations', () => {
    it('should create database file', async () => {
      // Ensure database is initialized
      await db.init();
      const dbPath = path.join(testDir, '.summon', 'tokens.db');
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it('should handle concurrent operations', async () => {
      // Perform multiple operations concurrently
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        operations.push(
          db.saveToken({
            realmId: `realm-${i}`,
            companyName: `Company ${i}`,
            accessToken: `access-${i}`,
            refreshToken: `refresh-${i}`,
            expiresAt: Date.now() + 3600000
          })
        );
      }
      
      // Wait for all operations to complete
      await Promise.all(operations);
      
      // Verify all tokens were saved
      const companies = await db.listCompanies();
      expect(companies).toHaveLength(10);
    });

    it('should enforce unique realm_id constraint', async () => {
      const token = {
        realmId: 'duplicate-realm',
        companyName: 'Company 1',
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: Date.now() + 3600000
      };
      
      await db.saveToken(token);
      
      // Saving with same realmId should update, not duplicate
      await db.saveToken({ ...token, companyName: 'Company 2' });
      
      const companies = await db.listCompanies();
      expect(companies).toHaveLength(1);
      expect(companies[0].companyName).toBe('Company 2');
    });
  });

  describe('error handling', () => {
    it('should handle invalid database path gracefully', () => {
      const invalidPath = '/root/invalid/path';
      
      expect(() => new TokenDatabase(invalidPath)).toThrow();
    });
  });
});