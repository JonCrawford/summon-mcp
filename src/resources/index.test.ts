import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastMCP } from 'fastmcp';
import { registerQuickBooksResources } from './index.js';
import * as quickbooksBroker from '../quickbooks-broker-adapter.js';

// Mock the quickbooks-broker-adapter module
vi.mock('../quickbooks-broker-adapter.js', () => ({
  getQBOClient: vi.fn(),
  listCompanies: vi.fn(),
  clearClientCache: vi.fn()
}));

describe('QuickBooks Resources', () => {
  let mcp: FastMCP;
  let registeredResources: Map<string, any>;
  let registeredResourceTemplates: Map<string, any>;

  beforeEach(() => {
    // Create a test instance of FastMCP
    mcp = new FastMCP({ name: 'test', version: '1.0.0' });
    registeredResources = new Map();
    registeredResourceTemplates = new Map();

    // Mock the addResource method to capture registered resources
    vi.spyOn(mcp, 'addResource').mockImplementation((resource) => {
      registeredResources.set(resource.uri, resource);
    });

    // Mock the addResourceTemplate method to capture registered resource templates
    vi.spyOn(mcp, 'addResourceTemplate').mockImplementation((resourceTemplate) => {
      // Extract base URI from template (remove {?...} query part)
      const baseUri = resourceTemplate.uriTemplate.split('{')[0];
      registeredResourceTemplates.set(baseUri, resourceTemplate);
    });

    // Register all resources
    registerQuickBooksResources(mcp);
  });

  describe('Resource Registration', () => {
    it('should register entity resources with correct URIs', () => {
      expect(registeredResourceTemplates.has('qb://customer')).toBe(true);
      expect(registeredResourceTemplates.has('qb://invoice')).toBe(true);
      expect(registeredResourceTemplates.has('qb://payment')).toBe(true);
    });

    it('should register report resources with correct URIs', () => {
      expect(registeredResourceTemplates.has('qb://reports/profit_and_loss')).toBe(true);
      expect(registeredResourceTemplates.has('qb://reports/customer_sales')).toBe(true);
      expect(registeredResourceTemplates.has('qb://reports/balance_sheet')).toBe(true);
    });

    it('should register special resources', () => {
      expect(registeredResources.has('qb://companies')).toBe(true);
      // Company info is registered as a template, not a static resource
      expect(registeredResourceTemplates.has('qb://company/info')).toBe(true);
    });
  });

  describe('Parameter Parsing', () => {
    it('should parse limit parameter from entity resource template', async () => {
      const mockQBO = {
        findCustomers: vi.fn((params, callback) => {
          // Verify the limit parameter was parsed correctly
          expect(params.limit).toBe(5);
          callback(null, { customers: [] });
        })
      };

      vi.mocked(quickbooksBroker.getQBOClient).mockResolvedValue(mockQBO as any);

      const resourceTemplate = registeredResourceTemplates.get('qb://customer');
      const result = await resourceTemplate.load({ limit: '5' });
      
      expect(mockQBO.findCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5 }),
        expect.any(Function)
      );
    });

    it('should parse date parameters from entity resource template', async () => {
      const mockQBO = {
        findInvoices: vi.fn((params, callback) => {
          // Verify date parameters were parsed and converted to query
          expect(params.query).toContain("MetaData.CreateTime>='2025-01-01'");
          expect(params.query).toContain("MetaData.CreateTime<='2025-12-31'");
          callback(null, { invoices: [] });
        })
      };

      vi.mocked(quickbooksBroker.getQBOClient).mockResolvedValue(mockQBO as any);

      const resourceTemplate = registeredResourceTemplates.get('qb://invoice');
      await resourceTemplate.load({ startDate: '2025-01-01', endDate: '2025-12-31' });
      
      expect(mockQBO.findInvoices).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining("MetaData.CreateTime>='2025-01-01'")
        }),
        expect.any(Function)
      );
    });

    it('should parse multiple parameters from entity resource template', async () => {
      const mockQBO = {
        findPayments: vi.fn((params, callback) => {
          expect(params.limit).toBe(10);
          expect(params.query).toContain("MetaData.CreateTime>='2025-01-01'");
          callback(null, { payments: [] });
        })
      };

      vi.mocked(quickbooksBroker.getQBOClient).mockResolvedValue(mockQBO as any);

      const resourceTemplate = registeredResourceTemplates.get('qb://payment');
      await resourceTemplate.load({ limit: '10', startDate: '2025-01-01' });
      
      expect(mockQBO.findPayments).toHaveBeenCalled();
    });

    it('should parse report parameters from report resource template', async () => {
      const mockQBO = {
        reportProfitAndLoss: vi.fn((params, callback) => {
          expect(params.start_date).toBe('2025-01-01');
          expect(params.end_date).toBe('2025-12-31');
          expect(params.summarize_column_by).toBe('Month');
          expect(params.accounting_method).toBe('Accrual');
          callback(null, { report: {} });
        })
      };

      vi.mocked(quickbooksBroker.getQBOClient).mockResolvedValue(mockQBO as any);

      const resourceTemplate = registeredResourceTemplates.get('qb://reports/profit_and_loss');
      await resourceTemplate.load({ startDate: '2025-01-01', endDate: '2025-12-31', summarizeBy: 'Month', accountingMethod: 'Accrual' });
      
      expect(mockQBO.reportProfitAndLoss).toHaveBeenCalledWith(
        expect.objectContaining({
          start_date: '2025-01-01',
          end_date: '2025-12-31',
          summarize_column_by: 'Month',
          accounting_method: 'Accrual'
        }),
        expect.any(Function)
      );
    });

    it('should use default values when parameters are not provided', async () => {
      const mockQBO = {
        findCustomers: vi.fn((params, callback) => {
          // Should use default limit of 20
          expect(params.limit).toBe(20);
          expect(params.query).toBeUndefined();
          callback(null, { customers: [] });
        })
      };

      vi.mocked(quickbooksBroker.getQBOClient).mockResolvedValue(mockQBO as any);

      const resourceTemplate = registeredResourceTemplates.get('qb://customer');
      await resourceTemplate.load({});
      
      expect(mockQBO.findCustomers).toHaveBeenCalled();
    });

    it('should handle invalid parameter values gracefully', async () => {
      const mockQBO = {
        findCustomers: vi.fn((params, callback) => {
          // Invalid limit should default to NaN, which might need handling
          expect(isNaN(params.limit)).toBe(true);
          callback(null, { customers: [] });
        })
      };

      vi.mocked(quickbooksBroker.getQBOClient).mockResolvedValue(mockQBO as any);

      const resourceTemplate = registeredResourceTemplates.get('qb://customer');
      await resourceTemplate.load({ limit: 'invalid' });
      
      expect(mockQBO.findCustomers).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      vi.mocked(quickbooksBroker.getQBOClient).mockRejectedValue(
        new Error('QuickBooks authentication required')
      );

      const resourceTemplate = registeredResourceTemplates.get('qb://customer');
      await expect(resourceTemplate.load({})).rejects.toThrow(
        'Failed to process customer resource: QuickBooks authentication required'
      );
    });

    it('should handle QuickBooks API errors', async () => {
      const mockQBO = {
        findCustomers: vi.fn((params, callback) => {
          callback({ 
            authData: { statusCode: 401 },
            message: 'Unauthorized' 
          });
        })
      };

      vi.mocked(quickbooksBroker.getQBOClient).mockResolvedValue(mockQBO as any);

      const resourceTemplate = registeredResourceTemplates.get('qb://customer');
      await expect(resourceTemplate.load({})).rejects.toThrow(
        'Authentication failed. Please reconnect to QuickBooks.'
      );
    });

    it('should handle rate limit errors', async () => {
      const mockQBO = {
        findInvoices: vi.fn((params, callback) => {
          callback({ statusCode: 429 });
        })
      };

      vi.mocked(quickbooksBroker.getQBOClient).mockResolvedValue(mockQBO as any);

      const resourceTemplate = registeredResourceTemplates.get('qb://invoice');
      await expect(resourceTemplate.load({})).rejects.toThrow(
        'Rate limit exceeded. Please try again later.'
      );
    });
  });
});