import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenDatabase } from './token-database.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('TokenDatabase', () => {
  const testDir = path.join(os.tmpdir(), 'token-database-test-' + Date.now());
  let db: TokenDatabase;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Default to sandbox mode
    process.env.QB_PRODUCTION = 'false';
    
    db = new TokenDatabase(testDir);
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
    it('should create database file in specified directory', () => {
      const dbPath = path.join(testDir, '.summon', 'tokens.db');
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it('should create directory if it does not exist', () => {
      const newDir = path.join(testDir, 'nested', 'path');
      const testDb = new TokenDatabase(newDir);
      
      const summonDir = path.join(newDir, '.summon');
      expect(fs.existsSync(summonDir)).toBe(true);
      expect(fs.existsSync(path.join(summonDir, 'tokens.db'))).toBe(true);
      
      testDb.close();
      fs.rmSync(path.join(testDir, 'nested'), { recursive: true });
    });

    it('should always create .summon subdirectory', () => {
      const baseDir = path.join(testDir, 'custom');
      const testDb = new TokenDatabase(baseDir);
      
      // Should always create .summon subdirectory
      const summonDir = path.join(baseDir, '.summon');
      expect(fs.existsSync(summonDir)).toBe(true);
      expect(fs.existsSync(path.join(summonDir, 'tokens.db'))).toBe(true);
      
      testDb.close();
    });
  });

  describe('saveToken', () => {
    it('should save token with all fields', () => {
      const tokenData = {
        realmId: 'test-realm-123',
        companyName: 'Test Company Inc',
        accessToken: 'access-token-xyz',
        refreshToken: 'refresh-token-abc',
        expiresAt: Date.now() + 3600000
      };
      
      db.saveToken(tokenData);
      
      const loaded = db.loadToken('test-realm-123');
      expect(loaded).toMatchObject({
        ...tokenData,
        expiresAt: Math.floor(tokenData.expiresAt / 1000) * 1000
      });
    });

    it('should update existing token for same realmId', () => {
      const initialToken = {
        realmId: 'update-realm',
        companyName: 'Initial Company',
        accessToken: 'initial-access',
        refreshToken: 'initial-refresh',
        expiresAt: Date.now()
      };
      
      db.saveToken(initialToken);
      
      const updatedToken = {
        realmId: 'update-realm',
        companyName: 'Updated Company',
        accessToken: 'updated-access',
        refreshToken: 'updated-refresh',
        expiresAt: Date.now() + 7200000
      };
      
      db.saveToken(updatedToken);
      
      const loaded = db.loadToken('update-realm');
      expect(loaded).toMatchObject({
        ...updatedToken,
        expiresAt: Math.floor(updatedToken.expiresAt / 1000) * 1000
      });
      
      // Should still have only one company
      const companies = db.listCompanies();
      expect(companies).toHaveLength(1);
    });

    it('should save with correct environment', () => {
      process.env.QB_PRODUCTION = 'true';
      const prodDb = new TokenDatabase(testDir + '-prod');
            
      const tokenData = {
        realmId: 'prod-realm',
        companyName: 'Production Company',
        accessToken: 'prod-access',
        refreshToken: 'prod-refresh',
        expiresAt: Date.now()
      };
      
      prodDb.saveToken(tokenData);
      const loaded = prodDb.loadToken('prod-realm');
      expect(loaded).toMatchObject({
        ...tokenData,
        expiresAt: Math.floor(tokenData.expiresAt / 1000) * 1000
      });
      
      prodDb.close();
      fs.rmSync(testDir + '-prod', { recursive: true });
    });
  });

  describe('loadToken', () => {
    it('should return null for non-existent token', () => {
      const loaded = db.loadToken('non-existent-realm');
      expect(loaded).toBeNull();
    });

    it('should only load tokens from current environment', () => {
      // Save sandbox token
      const sandboxToken = {
        realmId: 'realm-1',
        companyName: 'Sandbox Company',
        accessToken: 'sandbox-access',
        refreshToken: 'sandbox-refresh',
        expiresAt: Date.now()
      };
      
      db.saveToken(sandboxToken);
      
      // Switch to production and try to load
      process.env.QB_PRODUCTION = 'true';
      const prodDb = new TokenDatabase(testDir);
            
      const loaded = prodDb.loadToken('realm-1');
      expect(loaded).toBeNull();
      
      prodDb.close();
    });
  });

  describe('loadTokenByCompanyName', () => {
    beforeEach(() => {
      db.saveToken({
        realmId: 'realm-1',
        companyName: 'XYZ Roofing Company',
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: Date.now()
      });
    });

    it('should find by exact company name', () => {
      const loaded = db.loadTokenByCompanyName('XYZ Roofing Company');
      expect(loaded?.realmId).toBe('realm-1');
    });

    it('should require exact match (case sensitive)', () => {
      const loaded = db.loadTokenByCompanyName('xyz roofing company');
      expect(loaded).toBeNull();
    });

    it('should return null when no match found', () => {
      const loaded = db.loadTokenByCompanyName('Non-existent Company');
      expect(loaded).toBeNull();
    });

    it('should handle special characters in company names', () => {
      db.saveToken({
        realmId: 'realm-3',
        companyName: 'Smith & Jones, LLC',
        accessToken: 'access-3',
        refreshToken: 'refresh-3',
        expiresAt: Date.now()
      });

      const loaded = db.loadTokenByCompanyName('Smith & Jones, LLC');
      expect(loaded?.realmId).toBe('realm-3');
    });
  });

  describe('clearTokens', () => {
    it('should delete existing token', () => {
      const tokenData = {
        realmId: 'delete-realm',
        companyName: 'Delete Company',
        accessToken: 'delete-access',
        refreshToken: 'delete-refresh',
        expiresAt: Date.now()
      };
      
      db.saveToken(tokenData);
      db.clearTokens('delete-realm');
      
      const loaded = db.loadToken('delete-realm');
      expect(loaded).toBeNull();
    });

    it('should only delete from current environment', () => {
      // Save to sandbox
      db.saveToken({
        realmId: 'env-realm',
        companyName: 'Env Company',
        accessToken: 'env-access',
        refreshToken: 'env-refresh',
        expiresAt: Date.now()
      });
      
      // Delete from production environment (should not affect sandbox)
      process.env.QB_PRODUCTION = 'true';
      const prodDb = new TokenDatabase(testDir);
            prodDb.clearTokens('env-realm');
      prodDb.close();
      
      // Should still exist in sandbox
      const loaded = db.loadToken('env-realm');
      expect(loaded).not.toBeNull();
    });
  });

  describe('listCompanies', () => {
    it('should return empty array when no companies', () => {
      const companies = db.listCompanies();
      expect(companies).toEqual([]);
    });

    it('should list all companies in current environment', () => {
      db.saveToken({
        realmId: 'realm-1',
        companyName: 'Company A',
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: Date.now()
      });
      
      db.saveToken({
        realmId: 'realm-2',
        companyName: 'Company B',
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        expiresAt: Date.now()
      });
      
      const companies = db.listCompanies();
      expect(companies).toHaveLength(2);
      expect(companies.map(c => c.companyName).sort()).toEqual(['Company A', 'Company B']);
    });

    it('should not list companies from other environments', () => {
      // Save to sandbox
      db.saveToken({
        realmId: 'sandbox-realm',
        companyName: 'Sandbox Company',
        accessToken: 'sandbox-access',
        refreshToken: 'sandbox-refresh',
        expiresAt: Date.now()
      });
      
      // Check production environment
      process.env.QB_PRODUCTION = 'true';
      const prodDb = new TokenDatabase(testDir);
            
      const companies = prodDb.listCompanies();
      expect(companies).toEqual([]);
      
      prodDb.close();
    });
  });

  describe('hasTokens', () => {
    it('should return false when no tokens', () => {
      const hasTokens = db.hasTokens();
      expect(hasTokens).toBe(false);
    });

    it('should return true when tokens exist', () => {
      db.saveToken({
        realmId: 'test-realm',
        companyName: 'Test Company',
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        expiresAt: Date.now()
      });
      
      const hasTokens = db.hasTokens();
      expect(hasTokens).toBe(true);
    });

    it('should check current environment only', () => {
      // Save to sandbox
      db.saveToken({
        realmId: 'sandbox-realm',
        companyName: 'Sandbox Company',
        accessToken: 'sandbox-access',
        refreshToken: 'sandbox-refresh',
        expiresAt: Date.now()
      });
      
      // Check production environment (should be false)
      process.env.QB_PRODUCTION = 'true';
      const prodDb = new TokenDatabase(testDir);
            
      const hasTokens = prodDb.hasTokens();
      expect(hasTokens).toBe(false);
      
      prodDb.close();
    });
  });

  describe('concurrent access', () => {
    it('should handle multiple saves without corruption', () => {
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
      
      Promise.all(savePromises);
      
      const companies = db.listCompanies();
      expect(companies).toHaveLength(10);
    });

    it('should handle interleaved reads and writes', () => {
      db.saveToken({
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
      
      Promise.all(operations);
      
      const final = db.loadToken('read-write-realm');
      expect(final?.accessToken).toMatch(/access-\d+/);
    });
  });

  describe('close', () => {
    it('should close database connection', () => {
      db.saveToken({
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