import { describe, it, expect, vi } from 'vitest';
import { searchTransactions, generateSearchSummary } from './search-transactions';

describe('Search Transactions Tool', () => {
  const mockQBO = {
    findBills: vi.fn(),
    findBillPayments: vi.fn(),
    findPurchases: vi.fn(),
    findChecks: vi.fn(),
    findExpenses: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Account Filtering', () => {
    it('should filter transactions by account name', async () => {
      // Mock response with transactions using different accounts
      const mockBills = {
        QueryResponse: {
          Bill: [
            {
              Id: '1',
              TxnDate: '2024-01-15',
              EntityRef: { name: 'IRS' },
              TotalAmt: 5000,
              AccountRef: { name: 'Tax Expense' },
              Line: [
                {
                  Amount: 5000,
                  AccountBasedExpenseLineDetail: {
                    AccountRef: { name: 'Tax Expense' }
                  }
                }
              ]
            },
            {
              Id: '2',
              TxnDate: '2024-01-20',
              EntityRef: { name: 'IRS' },
              TotalAmt: 3000,
              AccountRef: { name: 'Operating Expense' },
              Line: [
                {
                  Amount: 3000,
                  AccountBasedExpenseLineDetail: {
                    AccountRef: { name: 'Operating Expense' }
                  }
                }
              ]
            }
          ]
        }
      };

      mockQBO.findBills.mockImplementation((filters, callback) => {
        callback(null, mockBills);
      });
      mockQBO.findBillPayments.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { BillPayment: [] } });
      });
      mockQBO.findPurchases.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Purchase: [] } });
      });
      mockQBO.findChecks.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Check: [] } });
      });
      mockQBO.findExpenses.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Expense: [] } });
      });

      const results = await searchTransactions(mockQBO, {
        searchTerms: ['IRS'],
        accountNames: ['Tax Expense']
      });

      // Should only include the transaction with Tax Expense account
      expect(results.transactions).toHaveLength(1);
      expect(results.transactions[0].id).toBe('1');
      expect(results.transactions[0].accountNames).toContain('Tax Expense');
      expect(results.summary.totalAmount).toBe(5000);
    });

    it('should match any account in the filter array (OR logic)', async () => {
      const mockExpenses = {
        QueryResponse: {
          Expense: [
            {
              Id: '1',
              TxnDate: '2024-01-15',
              EntityRef: { name: 'IRS' },
              TotalAmt: 5000,
              AccountRef: { name: 'Federal Tax Payable' },
              Line: []
            },
            {
              Id: '2',
              TxnDate: '2024-01-20',
              EntityRef: { name: 'IRS' },
              TotalAmt: 3000,
              AccountRef: { name: 'State Tax Payable' },
              Line: []
            },
            {
              Id: '3',
              TxnDate: '2024-01-25',
              EntityRef: { name: 'IRS' },
              TotalAmt: 2000,
              AccountRef: { name: 'Operating Expense' },
              Line: []
            }
          ]
        }
      };

      mockQBO.findExpenses.mockImplementation((filters, callback) => {
        callback(null, mockExpenses);
      });
      mockQBO.findBills.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Bill: [] } });
      });
      mockQBO.findBillPayments.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { BillPayment: [] } });
      });
      mockQBO.findPurchases.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Purchase: [] } });
      });
      mockQBO.findChecks.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Check: [] } });
      });

      const results = await searchTransactions(mockQBO, {
        searchTerms: ['IRS'],
        accountNames: ['Federal Tax Payable', 'State Tax Payable']
      });

      // Should include both tax payable transactions but not operating expense
      expect(results.transactions).toHaveLength(2);
      expect(results.transactions.map(t => t.id).sort()).toEqual(['1', '2']);
      expect(results.summary.totalAmount).toBe(8000);
    });

    it('should check line item accounts', async () => {
      const mockBills = {
        QueryResponse: {
          Bill: [
            {
              Id: '1',
              TxnDate: '2024-01-15',
              EntityRef: { name: 'Multi-vendor Invoice' },
              TotalAmt: 10000,
              AccountRef: { name: 'Accounts Payable' },
              Line: [
                {
                  Amount: 5000,
                  Description: 'IRS payment',
                  AccountBasedExpenseLineDetail: {
                    AccountRef: { name: 'Federal Tax Expense' }
                  }
                },
                {
                  Amount: 5000,
                  Description: 'Office supplies',
                  AccountBasedExpenseLineDetail: {
                    AccountRef: { name: 'Office Expense' }
                  }
                }
              ]
            }
          ]
        }
      };

      mockQBO.findBills.mockImplementation((filters, callback) => {
        callback(null, mockBills);
      });
      mockQBO.findBillPayments.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { BillPayment: [] } });
      });
      mockQBO.findPurchases.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Purchase: [] } });
      });
      mockQBO.findChecks.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Check: [] } });
      });
      mockQBO.findExpenses.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Expense: [] } });
      });

      const results = await searchTransactions(mockQBO, {
        searchTerms: ['IRS'],
        accountNames: ['Federal Tax Expense']
      });

      // Should include the transaction because it has a line item with the target account
      expect(results.transactions).toHaveLength(1);
      expect(results.transactions[0].accountNames).toContain('Federal Tax Expense');
      expect(results.transactions[0].accountNames).toContain('Office Expense');
      expect(results.transactions[0].accountNames).toContain('Accounts Payable');
    });

    it('should handle partial account name matches', async () => {
      const mockChecks = {
        QueryResponse: {
          Check: [
            {
              Id: '1',
              TxnDate: '2024-01-15',
              EntityRef: { name: 'IRS' },
              TotalAmt: 5000,
              AccountRef: { name: 'Federal Tax Expense - Quarterly' },
              Line: []
            },
            {
              Id: '2',
              TxnDate: '2024-01-20',
              EntityRef: { name: 'IRS' },
              TotalAmt: 3000,
              AccountRef: { name: 'State Tax Expense' },
              Line: []
            }
          ]
        }
      };

      mockQBO.findChecks.mockImplementation((filters, callback) => {
        callback(null, mockChecks);
      });
      mockQBO.findBills.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Bill: [] } });
      });
      mockQBO.findBillPayments.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { BillPayment: [] } });
      });
      mockQBO.findPurchases.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Purchase: [] } });
      });
      mockQBO.findExpenses.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Expense: [] } });
      });

      const results = await searchTransactions(mockQBO, {
        searchTerms: ['IRS'],
        accountNames: ['Federal Tax']  // Partial match
      });

      // Should match "Federal Tax Expense - Quarterly" but not "State Tax Expense"
      expect(results.transactions).toHaveLength(1);
      expect(results.transactions[0].id).toBe('1');
    });

    it('should work without account filter', async () => {
      const mockPurchases = {
        QueryResponse: {
          Purchase: [
            {
              Id: '1',
              TxnDate: '2024-01-15',
              EntityRef: { name: 'IRS' },
              TotalAmt: 5000,
              AccountRef: { name: 'Any Account' },
              Line: []
            }
          ]
        }
      };

      mockQBO.findPurchases.mockImplementation((filters, callback) => {
        callback(null, mockPurchases);
      });
      mockQBO.findBills.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Bill: [] } });
      });
      mockQBO.findBillPayments.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { BillPayment: [] } });
      });
      mockQBO.findChecks.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Check: [] } });
      });
      mockQBO.findExpenses.mockImplementation((filters, callback) => {
        callback(null, { QueryResponse: { Expense: [] } });
      });

      const results = await searchTransactions(mockQBO, {
        searchTerms: ['IRS']
        // No accountNames filter
      });

      // Should include the transaction when no account filter is provided
      expect(results.transactions).toHaveLength(1);
    });
  });

  describe('Summary Generation with Accounts', () => {
    it('should include account summary in results', async () => {
      const results = {
        summary: {
          totalCount: 3,
          totalAmount: 15000,
          byType: {
            Bill: { count: 2, amount: 10000 },
            Check: { count: 1, amount: 5000 }
          },
          byVendor: {
            'IRS': { count: 3, amount: 15000 }
          },
          byMonth: {
            '2024-01': { count: 3, amount: 15000 }
          },
          byAccount: {
            'Federal Tax Expense': { count: 2, amount: 10000 },
            'State Tax Expense': { count: 1, amount: 5000 }
          }
        },
        transactions: []
      };

      const summary = generateSearchSummary(results, ['IRS']);

      expect(summary).toContain('Top accounts:');
      expect(summary).toContain('Federal Tax Expense: $10,000.00 (2 transactions)');
      expect(summary).toContain('State Tax Expense: $5,000.00 (1 transactions)');
    });
  });
});