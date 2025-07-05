import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CacheManager } from '../src/cache-manager.js';
import { TokenBrokerClient } from '../src/token-broker-client.js';

// Mock fs module
vi.mock('fs');

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockBrokerClient: TokenBrokerClient;
  const testCacheDir = path.join(os.tmpdir(), 'test-qb-cache');
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock broker client
    mockBrokerClient = {
      listCompanies: vi.fn(),
      getAccessToken: vi.fn(),
      healthCheck: vi.fn(),
      detectCompanyFromContext: vi.fn()
    } as any;
    
    // Mock fs methods
    (fs.existsSync as any).mockReturnValue(false);
    (fs.mkdirSync as any).mockImplementation(() => {});
    (fs.readFileSync as any).mockImplementation(() => {
      throw new Error('File not found');
    });
    (fs.writeFileSync as any).mockImplementation(() => {});
    
    cacheManager = new CacheManager(mockBrokerClient, {
      cacheDir: testCacheDir,
      companyCacheTTL: 1, // 1 hour for tests
      brokerHealthTTL: 5 // 5 minutes
    });
  });
  
  describe('getCompanies', () => {
    it('should fetch from broker when cache is empty', async () => {
      const mockCompanies = [
        { id: '1', name: 'Test Co', realmId: '123', createdAt: '2024-01-01' }
      ];
      
      (mockBrokerClient.listCompanies as any).mockResolvedValue(mockCompanies);
      
      const companies = await cacheManager.getCompanies();
      
      expect(mockBrokerClient.listCompanies).toHaveBeenCalled();
      expect(companies).toEqual(mockCompanies);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
    
    it('should return cached companies when valid', async () => {
      // First call to populate cache
      const mockCompanies = [
        { id: '1', name: 'Test Co', realmId: '123', createdAt: '2024-01-01' }
      ];
      (mockBrokerClient.listCompanies as any).mockResolvedValue(mockCompanies);
      
      await cacheManager.getCompanies();
      
      // Reset mock
      vi.clearAllMocks();
      
      // Second call should use cache
      const cachedCompanies = await cacheManager.getCompanies();
      
      expect(mockBrokerClient.listCompanies).not.toHaveBeenCalled();
      expect(cachedCompanies).toEqual(mockCompanies);
    });
  });
  
  describe('getAccessToken', () => {
    it('should fetch token when not cached', async () => {
      const mockToken = {
        access_token: 'token123',
        realm_id: '123',
        company_name: 'Test Co',
        expires_at: Date.now() + 3600000 // 1 hour from now
      };
      
      (mockBrokerClient.getAccessToken as any).mockResolvedValue(mockToken);
      
      const token = await cacheManager.getAccessToken('company1');
      
      expect(mockBrokerClient.getAccessToken).toHaveBeenCalledWith('company1');
      expect(token).toEqual(mockToken);
    });
    
    it('should use cached token when valid', async () => {
      const mockToken = {
        access_token: 'token123',
        realm_id: '123',
        company_name: 'Test Co',
        expires_at: Date.now() + 3600000 // 1 hour from now
      };
      
      (mockBrokerClient.getAccessToken as any).mockResolvedValue(mockToken);
      
      // First call
      await cacheManager.getAccessToken('company1');
      
      // Reset mock
      vi.clearAllMocks();
      
      // Second call should use cache
      const cachedToken = await cacheManager.getAccessToken('company1');
      
      expect(mockBrokerClient.getAccessToken).not.toHaveBeenCalled();
      expect(cachedToken).toEqual(mockToken);
    });
    
    it('should refresh token when near expiry', async () => {
      const almostExpiredToken = {
        access_token: 'old-token',
        realm_id: '123',
        company_name: 'Test Co',
        expires_at: Date.now() + 240000 // 4 minutes from now (< 5 min buffer)
      };
      
      const newToken = {
        access_token: 'new-token',
        realm_id: '123',
        company_name: 'Test Co',
        expires_at: Date.now() + 3600000
      };
      
      (mockBrokerClient.getAccessToken as any)
        .mockResolvedValueOnce(almostExpiredToken)
        .mockResolvedValueOnce(newToken);
      
      // First call
      await cacheManager.getAccessToken('company1');
      
      // Second call should refresh due to near expiry
      const refreshedToken = await cacheManager.getAccessToken('company1');
      
      expect(mockBrokerClient.getAccessToken).toHaveBeenCalledTimes(2);
      expect(refreshedToken.access_token).toBe('new-token');
    });
  });
  
  describe('forceRefresh', () => {
    it('should clear all cached data', async () => {
      // Populate cache first
      const mockCompanies = [
        { id: '1', name: 'Test Co', realmId: '123', createdAt: '2024-01-01' }
      ];
      (mockBrokerClient.listCompanies as any).mockResolvedValue(mockCompanies);
      
      await cacheManager.getCompanies();
      
      // Force refresh
      await cacheManager.forceRefresh();
      
      // Verify cache was saved (empty)
      const lastCall = (fs.writeFileSync as any).mock.calls.slice(-1)[0];
      const savedData = JSON.parse(lastCall[1]);
      
      expect(savedData.companies).toBeUndefined();
      expect(Object.keys(savedData.tokens || {})).toHaveLength(0);
    });
  });
  
  describe('getCachedCompany', () => {
    it('should find company by ID, name, or realmId', async () => {
      const mockCompanies = [
        { id: '1', name: 'Test Co', realmId: '123', createdAt: '2024-01-01' },
        { id: '2', name: 'Other Co', realmId: '456', createdAt: '2024-01-01' }
      ];
      
      (mockBrokerClient.listCompanies as any).mockResolvedValue(mockCompanies);
      await cacheManager.getCompanies();
      
      expect(cacheManager.getCachedCompany('1')?.name).toBe('Test Co');
      expect(cacheManager.getCachedCompany('Test Co')?.id).toBe('1');
      expect(cacheManager.getCachedCompany('456')?.name).toBe('Other Co');
      expect(cacheManager.getCachedCompany('unknown')).toBeNull();
    });
  });
  
  describe('metrics', () => {
    it('should track cache hits and misses', async () => {
      const mockCompanies = [{ id: '1', name: 'Test Co', realmId: '123', createdAt: '2024-01-01' }];
      (mockBrokerClient.listCompanies as any).mockResolvedValue(mockCompanies);
      
      // First call - miss
      await cacheManager.getCompanies();
      
      // Second call - hit
      await cacheManager.getCompanies();
      
      const metrics = cacheManager.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.errors).toBe(0);
    });
  });
});