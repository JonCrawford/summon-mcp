import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerQuickBooksTools } from './index.js';
import { FastMCP } from 'fastmcp';
import { QuickBooksBroker } from '../quickbooks-broker-mt.js';

describe('QuickBooks Tools - Realm ID Support', () => {
  let mcp: FastMCP;
  let mockBroker: QuickBooksBroker;
  let registeredTools: Map<string, any>;

  beforeEach(() => {
    mcp = new FastMCP({ name: 'test', version: '1.0.0' });
    registeredTools = new Map();

    // Mock the addTool method to capture registered tools
    vi.spyOn(mcp, 'addTool').mockImplementation((tool) => {
      registeredTools.set(tool.name, tool);
    });

    // Create a mock broker
    mockBroker = {
      getQBOClient: vi.fn(),
      listCompanies: vi.fn(),
      getLastUsedCompanyInfo: vi.fn().mockReturnValue({
        name: 'Test Company',
        realmId: 'test-realm-id',
        companyName: 'Test Company'
      }),
    } as any;

    // Register tools
    registerQuickBooksTools(mcp, mockBroker);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Realm ID Parameter', () => {
    it('should include realmId in all entity tool parameters', () => {
      // Check that all qb_list_* tools have realmId parameter
      const entityTools = Array.from(registeredTools.entries())
        .filter(([name]) => name.startsWith('qb_list_') && name !== 'qb_list_companies');

      expect(entityTools.length).toBeGreaterThan(0);

      entityTools.forEach(([name, tool]) => {
        const schema = tool.parameters;
        expect(schema._def.shape()).toHaveProperty('realmId');
        
        // Verify realmId is optional
        const realmIdSchema = schema._def.shape().realmId;
        expect(realmIdSchema._def.typeName).toBe('ZodOptional');
      });
    });

    it('should pass realmId to broker when provided', async () => {
      const mockQBO = {
        findInvoices: vi.fn((params, callback) => {
          callback(null, { QueryResponse: { Invoice: [] } });
        }),
      };

      mockBroker.getQBOClient.mockResolvedValue(mockQBO);

      const tool = registeredTools.get('qb_list_invoices');
      expect(tool).toBeDefined();

      // Execute with realmId
      await tool.execute({
        realmId: '9341454914780836',
        limit: 10,
      });

      // Verify broker was called with realmId
      expect(mockBroker.getQBOClient).toHaveBeenCalledWith('9341454914780836');
    });

    it('should use realmId when provided', async () => {
      const mockQBO = {
        findCustomers: vi.fn((params, callback) => {
          callback(null, { QueryResponse: { Customer: [] } });
        }),
      };

      mockBroker.getQBOClient.mockResolvedValue(mockQBO);

      const tool = registeredTools.get('qb_list_customers');
      expect(tool).toBeDefined();

      // Execute with realmId
      await tool.execute({
        realmId: '9341454914780836',
        limit: 5,
      });

      // Should use the realmId
      expect(mockBroker.getQBOClient).toHaveBeenCalledWith('9341454914780836');
    });
  });

  describe('Authentication Error Handling', () => {
    it('should handle 401 errors by throwing authentication error', async () => {
      const mockQBO = {
        findInvoices: vi.fn((params, callback) => {
          // Return 401 error
          callback({
            authData: { statusCode: 401 },
            message: 'Unauthorized',
          });
        }),
      };

      mockBroker.getQBOClient.mockResolvedValue(mockQBO);

      const tool = registeredTools.get('qb_list_invoices');
      
      // Should throw authentication error
      await expect(tool.execute({ limit: 10 }))
        .rejects.toThrow('Authentication failed');
      
      // Should have called once
      expect(mockQBO.findInvoices).toHaveBeenCalledTimes(1);
      expect(mockBroker.getQBOClient).toHaveBeenCalledTimes(1);
    });

    it('should fail after token refresh if still unauthorized', async () => {
      const mockQBO = {
        findPayments: vi.fn((params, callback) => {
          // Always return 401
          callback({
            authData: { statusCode: 401 },
            message: 'Unauthorized',
          });
        }),
      };

      mockBroker.getQBOClient.mockResolvedValue(mockQBO);

      const tool = registeredTools.get('qb_list_payments');
      
      await expect(tool.execute({ limit: 10 }))
        .rejects.toThrow('Authentication failed');

      // Should have tried once (no automatic retry)
      expect(mockQBO.findPayments).toHaveBeenCalledTimes(1);
    });
  });

  describe('List Companies Tool', () => {
    it('should not require authentication to list companies', async () => {
      // Mock listCompanies to return previously authenticated companies
      mockBroker.listCompanies.mockResolvedValue([
        { name: 'Company A', realmId: '123' },
        { name: 'Company B', realmId: '456' },
      ]);

      const tool = registeredTools.get('qb_list_companies');
      expect(tool).toBeDefined();

      // Should work without any auth
      const result = await tool.execute({});

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveProperty('_context');
      expect(parsedResult).toHaveProperty('companies');
      expect(parsedResult.companies).toEqual([
        { name: 'Company A', realmId: '123' },
        { name: 'Company B', realmId: '456' },
      ]);

      // Should not have tried to get QBO client
      expect(mockBroker.getQBOClient).not.toHaveBeenCalled();
    });

    it('should return empty array when no companies authenticated', async () => {
      mockBroker.listCompanies.mockResolvedValue([]);

      const tool = registeredTools.get('qb_list_companies');
      const result = await tool.execute({});

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveProperty('_context');
      expect(parsedResult).toHaveProperty('companies');
      expect(parsedResult.companies).toEqual([]);
      expect(mockBroker.getQBOClient).not.toHaveBeenCalled();
    });
  });
});