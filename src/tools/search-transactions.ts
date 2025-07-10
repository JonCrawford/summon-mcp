/**
 * Search Transactions Tool
 * 
 * Provides flexible search capabilities for QuickBooks transactions
 * to answer questions like "How much have we paid to the IRS?"
 */

import { z } from 'zod';

// Search parameters schema
export const searchTransactionsSchema = z.object({
  realmId: z.string().optional().describe('The realm ID of the QuickBooks company to query'),
  searchTerms: z.array(z.string()).describe('Array of search terms to look for in vendor names or memos (e.g., ["IRS", "Internal Revenue", "Federal Tax"])'),
  transactionTypes: z.array(z.enum(['Bill', 'BillPayment', 'Purchase', 'Check', 'Expense'])).optional()
    .describe('Types of transactions to search. Defaults to all types if not specified'),
  startDate: z.string().optional().describe('Start date for filtering (ISO format)'),
  endDate: z.string().optional().describe('End date for filtering (ISO format)'),
  accountNames: z.array(z.string()).optional().describe('Array of account names to filter by (e.g., ["Tax Expense", "Federal Tax Payable"]). Uses OR logic - matches if transaction uses ANY of these accounts'),
  minAmount: z.number().optional().describe('Minimum transaction amount'),
  maxAmount: z.number().optional().describe('Maximum transaction amount'),
  includeLineDetails: z.boolean().optional().default(false).describe('Include line item details in results'),
  limit: z.number().optional().default(1000).describe('Maximum number of results per transaction type')
});

export type SearchTransactionsParams = z.infer<typeof searchTransactionsSchema>;

/**
 * Build QuickBooks query filter for vendor name search
 */
export function buildVendorSearchQuery(searchTerms: string[]): any[] {
  // Create LIKE queries for each search term
  const vendorQueries = searchTerms.map(term => ({
    field: 'EntityRef.name',
    value: `%${term}%`,
    operator: 'LIKE'
  }));

  // Also search in memo fields
  const memoQueries = searchTerms.map(term => ({
    field: 'PrivateNote',
    value: `%${term}%`,
    operator: 'LIKE'
  }));

  // Combine with OR logic (any match)
  return [...vendorQueries, ...memoQueries];
}

/**
 * Format date range filter
 */
export function buildDateRangeFilter(startDate?: string, endDate?: string): any[] {
  const filters: any[] = [];
  
  if (startDate) {
    filters.push({
      field: 'TxnDate',
      value: startDate,
      operator: '>='
    });
  }
  
  if (endDate) {
    filters.push({
      field: 'TxnDate',
      value: endDate,
      operator: '<='
    });
  }
  
  return filters;
}

/**
 * Build amount range filter
 */
export function buildAmountFilter(minAmount?: number, maxAmount?: number): any[] {
  const filters: any[] = [];
  
  if (minAmount !== undefined) {
    filters.push({
      field: 'TotalAmt',
      value: minAmount.toString(),
      operator: '>='
    });
  }
  
  if (maxAmount !== undefined) {
    filters.push({
      field: 'TotalAmt',
      value: maxAmount.toString(),
      operator: '<='
    });
  }
  
  return filters;
}

/**
 * Search multiple transaction types in parallel
 */
export async function searchTransactions(
  qbo: any,
  params: SearchTransactionsParams
): Promise<any> {
  const transactionTypes = params.transactionTypes || ['Bill', 'BillPayment', 'Purchase', 'Check', 'Expense'];
  const results: any = {
    summary: {
      totalCount: 0,
      totalAmount: 0,
      byType: {},
      byVendor: {},
      byMonth: {},
      byAccount: {}
    },
    transactions: []
  };

  // Build base filters
  const baseFilters = [
    ...buildDateRangeFilter(params.startDate, params.endDate),
    ...buildAmountFilter(params.minAmount, params.maxAmount),
    { field: 'limit', value: params.limit }
  ];

  // Search each transaction type
  const searchPromises = transactionTypes.map(async (type) => {
    const methodName = `find${type}s`;
    const method = qbo[methodName];
    
    if (!method) {
      console.error(`Method ${methodName} not found on QuickBooks client`);
      return null;
    }

    return new Promise((resolve) => {
      method.call(qbo, baseFilters, (err: any, response: any) => {
        if (err) {
          console.error(`Error searching ${type}:`, err);
          resolve(null);
        } else {
          resolve({ type, data: response });
        }
      });
    });
  });

  const searchResults = await Promise.all(searchPromises);

  // Process results and filter by search terms
  for (const result of searchResults) {
    if (!result || typeof result !== 'object') continue;
    
    const searchResult = result as { type: string; data: any };
    if (!searchResult.data) continue;

    const { type, data } = searchResult;
    const transactions = data.QueryResponse?.[type] || [];

    for (const transaction of transactions) {
      // Check if transaction matches search terms
      const vendorName = transaction.EntityRef?.name || '';
      const memo = transaction.PrivateNote || '';
      const lineDescriptions = transaction.Line?.map((l: any) => l.Description || '').join(' ') || '';
      
      const searchText = `${vendorName} ${memo} ${lineDescriptions}`.toLowerCase();
      
      const matchesSearch = params.searchTerms.some(term => 
        searchText.includes(term.toLowerCase())
      );

      // Check if transaction matches account filter
      let matchesAccount = true;
      if (params.accountNames && params.accountNames.length > 0) {
        // Check main account reference
        const mainAccountName = transaction.AccountRef?.name || '';
        
        // Check line item accounts
        const lineAccountNames = transaction.Line?.map((line: any) => {
          return line.AccountBasedExpenseLineDetail?.AccountRef?.name || 
                 line.JournalEntryLineDetail?.AccountRef?.name || 
                 line.DepositLineDetail?.AccountRef?.name || '';
        }).filter((name: string) => name) || [];
        
        // Combine all account names from the transaction
        const allAccountNames = [mainAccountName, ...lineAccountNames].filter(name => name);
        
        // Check if any transaction account matches any filter account
        matchesAccount = params.accountNames.some(filterAccount => 
          allAccountNames.some(txnAccount => 
            txnAccount.toLowerCase().includes(filterAccount.toLowerCase())
          )
        );
      }

      if (matchesSearch && matchesAccount) {
        // Add to results
        const txn = {
          type,
          id: transaction.Id,
          date: transaction.TxnDate,
          vendorName,
          memo,
          amount: transaction.TotalAmt || 0,
          accountRef: transaction.AccountRef,
          docNumber: transaction.DocNumber,
          lineCount: transaction.Line?.length || 0
        };

        if (params.includeLineDetails && transaction.Line) {
          (txn as any).lines = transaction.Line.map((line: any) => ({
            amount: line.Amount,
            description: line.Description,
            accountRef: line.AccountBasedExpenseLineDetail?.AccountRef
          }));
        }

        // Add account information to transaction
        const accountNames = new Set<string>();
        if (transaction.AccountRef?.name) {
          accountNames.add(transaction.AccountRef.name);
        }
        if (transaction.Line) {
          transaction.Line.forEach((line: any) => {
            const accountName = line.AccountBasedExpenseLineDetail?.AccountRef?.name || 
                               line.JournalEntryLineDetail?.AccountRef?.name || 
                               line.DepositLineDetail?.AccountRef?.name;
            if (accountName) {
              accountNames.add(accountName);
            }
          });
        }
        (txn as any).accountNames = Array.from(accountNames);

        results.transactions.push(txn);
        
        // Update summary
        results.summary.totalCount++;
        results.summary.totalAmount += txn.amount;
        
        // By type
        if (!results.summary.byType[type]) {
          results.summary.byType[type] = { count: 0, amount: 0 };
        }
        results.summary.byType[type].count++;
        results.summary.byType[type].amount += txn.amount;
        
        // By vendor
        if (vendorName) {
          if (!results.summary.byVendor[vendorName]) {
            results.summary.byVendor[vendorName] = { count: 0, amount: 0 };
          }
          results.summary.byVendor[vendorName].count++;
          results.summary.byVendor[vendorName].amount += txn.amount;
        }
        
        // By month
        const monthKey = transaction.TxnDate.substring(0, 7); // YYYY-MM
        if (!results.summary.byMonth[monthKey]) {
          results.summary.byMonth[monthKey] = { count: 0, amount: 0 };
        }
        results.summary.byMonth[monthKey].count++;
        results.summary.byMonth[monthKey].amount += txn.amount;
        
        // By account
        const txnAccountNames = (txn as any).accountNames || [];
        for (const accountName of txnAccountNames) {
          if (!results.summary.byAccount[accountName]) {
            results.summary.byAccount[accountName] = { count: 0, amount: 0 };
          }
          results.summary.byAccount[accountName].count++;
          results.summary.byAccount[accountName].amount += txn.amount;
        }
      }
    }
  }

  // Sort transactions by date descending
  results.transactions.sort((a: any, b: any) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return results;
}

/**
 * Helper to format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

/**
 * Generate natural language summary
 */
export function generateSearchSummary(results: any, searchTerms: string[]): string {
  const { summary } = results;
  
  if (summary.totalCount === 0) {
    return `No transactions found matching: ${searchTerms.join(', ')}`;
  }

  let summaryText = `Found ${summary.totalCount} transactions totaling ${formatCurrency(summary.totalAmount)} matching: ${searchTerms.join(', ')}\n\n`;

  // By vendor summary
  const vendorEntries = Object.entries(summary.byVendor)
    .map(([vendor, data]) => [vendor, data] as [string, any])
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 5);

  if (vendorEntries.length > 0) {
    summaryText += 'Top vendors:\n';
    for (const [vendor, data] of vendorEntries) {
      summaryText += `- ${vendor}: ${formatCurrency((data as any).amount)} (${(data as any).count} transactions)\n`;
    }
    summaryText += '\n';
  }

  // By type summary
  summaryText += 'By transaction type:\n';
  for (const [type, data] of Object.entries(summary.byType)) {
    summaryText += `- ${type}: ${formatCurrency((data as any).amount)} (${(data as any).count} transactions)\n`;
  }

  // By year summary
  const yearTotals: Record<string, { count: number; amount: number }> = {};
  for (const [month, data] of Object.entries(summary.byMonth)) {
    const year = month.substring(0, 4);
    if (!yearTotals[year]) {
      yearTotals[year] = { count: 0, amount: 0 };
    }
    yearTotals[year].count += (data as any).count;
    yearTotals[year].amount += (data as any).amount;
  }

  if (Object.keys(yearTotals).length > 1) {
    summaryText += '\nBy year:\n';
    for (const [year, data] of Object.entries(yearTotals).sort()) {
      summaryText += `- ${year}: ${formatCurrency(data.amount)} (${data.count} transactions)\n`;
    }
  }

  // By account summary (top 5)
  const accountEntries = Object.entries(summary.byAccount)
    .map(([account, data]) => [account, data] as [string, any])
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 5);

  if (accountEntries.length > 0) {
    summaryText += '\nTop accounts:\n';
    for (const [account, data] of accountEntries) {
      summaryText += `- ${account}: ${formatCurrency((data as any).amount)} (${(data as any).count} transactions)\n`;
    }
  }

  return summaryText;
}