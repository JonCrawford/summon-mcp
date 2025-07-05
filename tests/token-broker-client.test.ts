import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenBrokerClient, Company } from '../src/token-broker-client.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('TokenBrokerClient', () => {
  let client: TokenBrokerClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    client = new TokenBrokerClient({
      apiUrl: 'https://broker.example.com',
      apiToken: 'test-token',
      timeout: 5000
    });
  });
  
  describe('listCompanies', () => {
    it('should fetch and return companies list', async () => {
      const mockCompanies: Company[] = [
        {
          id: 'company1',
          name: 'Acme Corp',
          realmId: '123456',
          createdAt: '2024-01-01',
          lastAccessed: '2024-01-15'
        }
      ];
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCompanies
      });
      
      const companies = await client.listCompanies();
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://broker.example.com/api/tokens',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        })
      );
      
      expect(companies).toEqual(mockCompanies);
    });
    
    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });
      
      await expect(client.listCompanies()).rejects.toThrow(
        'Failed to list companies: Token broker returned 500: Internal Server Error'
      );
    });
  });
  
  describe('getAccessToken', () => {
    it('should fetch token for specific company', async () => {
      const mockToken = {
        access_token: 'access123',
        realm_id: '123456',
        company_name: 'Acme Corp',
        expires_at: Date.now() + 3600000
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockToken
      });
      
      const token = await client.getAccessToken('company1');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://broker.example.com/api/tokens/company1',
        expect.any(Object)
      );
      
      expect(token).toEqual(mockToken);
    });
    
    it('should handle 404 for unknown company', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404
      });
      
      await expect(client.getAccessToken('unknown')).rejects.toThrow(
        'Failed to get access token: Company "unknown" not found'
      );
    });
  });
  
  describe('detectCompanyFromContext', () => {
    const companies: Company[] = [
      { id: '1', name: 'Acme Corp', realmId: '123', createdAt: '2024-01-01' },
      { id: '2', name: 'Widget Inc', realmId: '456', createdAt: '2024-01-01' }
    ];
    
    it('should detect company by exact name match', () => {
      const result = client.detectCompanyFromContext(
        'Show me invoices for Acme Corp',
        companies
      );
      
      expect(result?.name).toBe('Acme Corp');
    });
    
    it('should detect company by case-insensitive match', () => {
      const result = client.detectCompanyFromContext(
        'show me acme corp data',
        companies
      );
      
      expect(result?.name).toBe('Acme Corp');
    });
    
    it('should detect company with possessive pattern', () => {
      const result = client.detectCompanyFromContext(
        "Show me Widget Inc's customers",
        companies
      );
      
      expect(result?.name).toBe('Widget Inc');
    });
    
    it('should return null when no company found', () => {
      const result = client.detectCompanyFromContext(
        'Show me all invoices',
        companies
      );
      
      expect(result).toBeNull();
    });
  });
});