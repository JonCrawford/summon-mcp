import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenDatabase } from './token-database.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('TokenDatabase', () => {
  const testDir = path.join(os.tmpdir(), 'token-database-test-' + Date.now());
  let db: TokenDatabase;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Default to sandbox mode
    process.env.QB_PRODUCTION = 'false';
    
    db = new TokenDatabase(testDir);
    await db.init();
  });

  afterEach(() => {
    db.close();
    
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    
    // Restore environment
    process.env = { ...originalEnv };
  });

  describe('constructor', () => {
    it('should create database file in specified directory', async () => {
      const dbPath = path.join(testDir, '.summon', 'tokens.db');
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it('should create directory if it does not exist', async () => {
      const newDir = path.join(testDir, 'nested', 'path');
      const testDb = new TokenDatabase(newDir);
      await testDb.init();
      
      const summonDir = path.join(newDir, '.summon');
      expect(fs.existsSync(summonDir)).toBe(true);
      expect(fs.existsSync(path.join(summonDir, 'tokens.db'))).toBe(true);
      
      testDb.close();
      fs.rmSync(path.join(testDir, 'nested'), { recursive: true });
    });

    it('should always create .summon subdirectory', async () => {
      const baseDir = path.join(testDir, 'custom');
      const testDb = new TokenDatabase(baseDir);
      await testDb.init();
      
      // Should always create .summon subdirectory
      const summonDir = path.join(baseDir, '.summon');
      expect(fs.existsSync(summonDir)).toBe(true);
      expect(fs.existsSync(path.join(summonDir, 'tokens.db'))).toBe(true);
      
      testDb.close();
    });
  });

  describe('saveToken', () => {
    it('should save token with all fields', async () => {
      const tokenData = {
        realmId: 'test-realm-123',
        companyName: 'Test Company Inc',
        accessToken: 'access-token-xyz',
        refreshToken: 'refresh-token-abc',
        expiresAt: Date.now() + 3600000
      };
      
      await db.saveToken(tokenData);
      
      const loaded = await db.loadToken('test-realm-123');
      expect(loaded).toMatchObject(tokenData);
    });

    it('should update existing token for same realmId', async () => {
      const initialToken = {
        realmId: 'update-realm',
        companyName: 'Initial Company',
        accessToken: 'initial-access',
        refreshToken: 'initial-refresh',
        expiresAt: Date.now()
      };
      
      await db.saveToken(initialToken);
      
      const updatedToken = {
        realmId: 'update-realm',
        companyName: 'Updated Company',
        accessToken: 'updated-access',
        refreshToken: 'updated-refresh',
        expiresAt: Date.now() + 7200000
      };
      
      await db.saveToken(updatedToken);
      
      const loaded = await db.loadToken('update-realm');
      expect(loaded).toMatchObject(updatedToken);
      
      // Should still have only one company
      const companies = await db.listCompanies();
      expect(companies).toHaveLength(1);
    });

    it('should save with correct environment', async () => {
      process.env.QB_PRODUCTION = 'true';
      const prodDb = new TokenDatabase(testDir + '-prod');
      await prodDb.init();
      
      const tokenData = {
        realmId: 'prod-realm',
        companyName: 'Production Company',
        accessToken: 'prod-access',
        refreshToken: 'prod-refresh',
        expiresAt: Date.now()
      };
      
      await prodDb.saveToken(tokenData);
      const loaded = await prodDb.loadToken('prod-realm');
      expect(loaded).toMatchObject(tokenData);
      
      prodDb.close();
      fs.rmSync(testDir + '-prod', { recursive: true });
    });
  });

  describe('loadToken', () => {
    it('should return null for non-existent token', async () => {
      const loaded = await db.loadToken('non-existent-realm');
      expect(loaded).toBeNull();
    });

    it('should only load tokens from current environment', async () => {
      // Save sandbox token
      const sandboxToken = {
        realmId: 'realm-1',
        companyName: 'Sandbox Company',
        accessToken: 'sandbox-access',
        refreshToken: 'sandbox-refresh',
        expiresAt: Date.now()
      };
      
      await db.saveToken(sandboxToken);
      
      // Switch to production and try to load
      process.env.QB_PRODUCTION = 'true';
      const prodDb = new TokenDatabase(testDir);
      await prodDb.init();
      
      const loaded = await prodDb.loadToken('realm-1');
      expect(loaded).toBeNull();
      
      prodDb.close();
    });
  });

  describe('loadTokenByCompanyName', () => {
    beforeEach(async () => {
      await db.saveToken({
        realmId: 'realm-1',
        companyName: 'XYZ Roofing Company',
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: Date.now()
      });
    });

    it('should find by exact company name', async () => {
      const loaded = await db.loadTokenByCompanyName('XYZ Roofing Company');
      expect(loaded?.realmId).toBe('realm-1');
    });

    it('should require exact match (case sensitive)', async () => {
      const loaded = await db.loadTokenByCompanyName('xyz roofing company');
      expect(loaded).toBeNull();
    });

    it('should return null when no match found', async () => {
      const loaded = await db.loadTokenByCompanyName('Non-existent Company');
      expect(loaded).toBeNull();
    });

    it('should handle special characters in company names', async () => {
      await db.saveToken({
        realmId: 'realm-3',
        companyName: 'Smith & Jones, LLC',
        accessToken: 'access-3',
        refreshToken: 'refresh-3',
        expiresAt: Date.now()
      });

      const loaded = await db.loadTokenByCompanyName('Smith & Jones, LLC');
      expect(loaded?.realmId).toBe('realm-3');
    });
  });

  describe('deleteToken', () => {
    it('should delete existing token', async () => {
      const tokenData = {
        realmId: 'delete-realm',
        companyName: 'Delete Company',
        accessToken: 'delete-access',
        refreshToken: 'delete-refresh',
        expiresAt: Date.now()
      };
      
      await db.saveToken(tokenData);
      await db.deleteToken('delete-realm');
      
      const loaded = await db.loadToken('delete-realm');
      expect(loaded).toBeNull();
    });

    it('should only delete from current environment', async () => {
      // Save to sandbox
      await db.saveToken({
        realmId: 'env-realm',
        companyName: 'Env Company',
        accessToken: 'env-access',
        refreshToken: 'env-refresh',
        expiresAt: Date.now()
      });
      
      // Delete from production environment (should not affect sandbox)
      process.env.QB_PRODUCTION = 'true';
      const prodDb = new TokenDatabase(testDir);
      await prodDb.init();
      await prodDb.deleteToken('env-realm');
      prodDb.close();
      
      // Should still exist in sandbox
      const loaded = await db.loadToken('env-realm');
      expect(loaded).not.toBeNull();
    });
  });

  describe('listCompanies', () => {
    it('should return empty array when no companies', async () => {
      const companies = await db.listCompanies();
      expect(companies).toEqual([]);
    });

    it('should list all companies in current environment', async () => {
      await db.saveToken({
        realmId: 'realm-1',
        companyName: 'Company A',
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: Date.now()
      });
      
      await db.saveToken({
        realmId: 'realm-2',
        companyName: 'Company B',
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        expiresAt: Date.now()
      });
      
      const companies = await db.listCompanies();
      expect(companies).toHaveLength(2);
      expect(companies.map(c => c.companyName).sort()).toEqual(['Company A', 'Company B']);
    });

    it('should not list companies from other environments', async () => {
      // Save to sandbox
      await db.saveToken({
        realmId: 'sandbox-realm',
        companyName: 'Sandbox Company',
        accessToken: 'sandbox-access',
        refreshToken: 'sandbox-refresh',
        expiresAt: Date.now()
      });
      
      // Check production environment
      process.env.QB_PRODUCTION = 'true';
      const prodDb = new TokenDatabase(testDir);
      await prodDb.init();
      
      const companies = await prodDb.listCompanies();
      expect(companies).toEqual([]);
      
      prodDb.close();
    });
  });

  describe('hasTokens', () => {
    it('should return false when no tokens', async () => {
      const hasTokens = await db.hasTokens();
      expect(hasTokens).toBe(false);
    });

    it('should return true when tokens exist', async () => {
      await db.saveToken({
        realmId: 'test-realm',
        companyName: 'Test Company',
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        expiresAt: Date.now()
      });
      
      const hasTokens = await db.hasTokens();
      expect(hasTokens).toBe(true);
    });

    it('should check current environment only', async () => {
      // Save to sandbox
      await db.saveToken({
        realmId: 'sandbox-realm',
        companyName: 'Sandbox Company',
        accessToken: 'sandbox-access',
        refreshToken: 'sandbox-refresh',
        expiresAt: Date.now()
      });
      
      // Check production environment (should be false)
      process.env.QB_PRODUCTION = 'true';
      const prodDb = new TokenDatabase(testDir);
      await prodDb.init();
      
      const hasTokens = await prodDb.hasTokens();
      expect(hasTokens).toBe(false);
      
      prodDb.close();
    });
  });

  describe('concurrent access', () => {
    it('should handle multiple saves without corruption', async () => {
      const savePromises = [];
      
      for (let i = 0; i < 10; i++) {
        const promise = db.saveToken({
          realmId: `realm-${i}`,
          companyName: `Company ${i}`,
          accessToken: `access-${i}`,
          refreshToken: `refresh-${i}`,
          expiresAt: Date.now()
        });
        savePromises.push(promise);
      }
      
      await Promise.all(savePromises);
      
      const companies = await db.listCompanies();
      expect(companies).toHaveLength(10);
    });

    it('should handle interleaved reads and writes', async () => {
      await db.saveToken({
        realmId: 'read-write-realm',
        companyName: 'Read Write Company',
        accessToken: 'access-initial',
        refreshToken: 'refresh-initial',
        expiresAt: Date.now()
      });
      
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        operations.push(
          db.saveToken({
            realmId: 'read-write-realm',
            companyName: 'Read Write Company',
            accessToken: `access-${i}`,
            refreshToken: `refresh-${i}`,
            expiresAt: Date.now()
          })
        );
        
        operations.push(db.loadToken('read-write-realm'));
      }
      
      await Promise.all(operations);
      
      const final = await db.loadToken('read-write-realm');
      expect(final?.accessToken).toMatch(/access-\d+/);
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      await db.saveToken({
        realmId: 'close-test',
        companyName: 'Close Test',
        accessToken: 'close-access',
        refreshToken: 'close-refresh',
        expiresAt: Date.now()
      });
      
      db.close();
      
      // Should not be able to operate after close
      expect(() => db.close()).not.toThrow();
    });
  });
});