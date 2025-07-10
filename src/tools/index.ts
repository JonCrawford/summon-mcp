import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { entities } from './entities.js';
import { QuickBooksBroker } from '../quickbooks-broker-mt.js';
import { withAuth } from './auth-wrapper.js';
import { ErrorFactory, issummonError } from '../errors/index.js';
import { searchTransactionsSchema, searchTransactions, generateSearchSummary } from './search-transactions.js';

// Common parameters for all QuickBooks list tools
const listParametersSchema = z.object({
  realmId: z.string().optional().describe('The realm ID of the QuickBooks company to query'),
  startDate: z.string().optional().describe('Start date for filtering (ISO format)'),
  endDate: z.string().optional().describe('End date for filtering (ISO format)'),
  limit: z.number().default(20).describe('Maximum number of results to return')
});

// Report types mapping (friendly name to SDK method name)
const reportTypes = {
  'profit_and_loss': 'reportProfitAndLoss',
  'balance_sheet': 'reportBalanceSheet',
  'cash_flow': 'reportCashFlow',
  'trial_balance': 'reportTrialBalance',
  'general_ledger': 'reportGeneralLedger',
  'customer_sales': 'reportCustomerSales',
  'item_sales': 'reportItemSales',
  'customer_balance': 'reportCustomerBalance',
  'customer_balance_detail': 'reportCustomerBalanceDetail',
  'aging_summary': 'reportAgedReceivables',
  'aging_detail': 'reportAgedReceivableDetail',
  'vendor_balance': 'reportVendorBalance',
  'vendor_balance_detail': 'reportVendorBalanceDetail',
  'vendor_aging': 'reportAgedPayables',
  'vendor_aging_detail': 'reportAgedPayableDetail',
  'inventory_summary': 'reportInventoryValuationSummary'
} as const;

/**
 * Register all QuickBooks entity tools with the MCP server
 * @param mcp - The FastMCP instance
 * @param broker - The QuickBooks broker instance
 */
export function registerQuickBooksTools(mcp: FastMCP, broker: QuickBooksBroker): void {
  // Register a tool for each entity
  entities.forEach(entity => {
    mcp.addTool({
      name: `qb_list_${entity.name}s`,
      description: `${entity.description} - IMPORTANT: Always mention the company name when presenting results. Check _context field for company details.`,
      parameters: listParametersSchema,
      execute: withAuth(async (args) => {
        try {
          // Get authenticated QuickBooks client for the specified company
          const qbo = await broker.getQBOClient(args.realmId);

          // Build query parameters
          const queryParams: any = {
            limit: args.limit
          };

          // Add date filtering if provided
          if (args.startDate || args.endDate) {
            const dateFilter = [];
            if (args.startDate) {
              dateFilter.push(`MetaData.CreateTime>='${args.startDate}'`);
            }
            if (args.endDate) {
              dateFilter.push(`MetaData.CreateTime<='${args.endDate}'`);
            }
            queryParams.query = dateFilter.join(' AND ');
          }

          // Call the appropriate SDK function
          const sdkFunction = (qbo as any)[entity.sdkFn];
          if (!sdkFunction) {
            throw new Error(`SDK function ${entity.sdkFn} not found`);
          }

          // Execute the query and return results
          return new Promise((resolve, reject) => {
            sdkFunction.call(qbo, queryParams, (err: any, data: any) => {
              if (err) {
                // Log specific error details for debugging
                console.error(`Error calling ${entity.sdkFn}:`, {
                  entity: entity.name,
                  error: err,
                  statusCode: err.statusCode,
                  message: err.message,
                  fault: err.fault
                });
                
                // Convert QuickBooks API errors to standardized error types
                const standardError = ErrorFactory.fromQuickBooksAPI(err, `qb_list_${entity.name}s`);
                reject(standardError);
              }
              else {
                // Get company info to include in response
                const companyInfo = broker.getLastUsedCompanyInfo();
                
                // Return the data as JSON string for MCP with company context
                resolve({
                  content: [{
                    type: 'text',
                    text: JSON.stringify({
                      _context: {
                        company_name: companyInfo?.companyName || 'Unknown Company',
                        realm_id: companyInfo?.realmId || qbo.realmId,
                        _instruction: `When presenting this data, always mention that it's from "${companyInfo?.companyName || 'the QuickBooks company'}" (Realm ID: ${companyInfo?.realmId || qbo.realmId})`
                      },
                      data: data
                    }, null, 2)
                  }]
                });
              }
            });
          });
        } catch (error) {
          // Re-throw SUMmon errors as-is
          if (issummonError(error)) {
            throw error;
          }

          // Convert to tool execution error
          throw ErrorFactory.fromToolExecution(error, `qb_list_${entity.name}s`);
        }
      })
    });
  });

  // Register CompanyInfo tool
  mcp.addTool({
    name: 'qb_company_info',
    description: 'Get QuickBooks company information - Always state which company\'s information you\'re displaying',
    parameters: z.object({
        realmId: z.string().optional().describe('The realm ID of the QuickBooks company to query')
    }),
    execute: withAuth(async (args) => {
      try {
        const qbo = await broker.getQBOClient(args.realmId);

        return new Promise((resolve, reject) => {
          // QuickBooks CompanyInfo typically has ID of 1
          (qbo as any).getCompanyInfo(qbo.realmId, (err: any, data: any) => {
            if (err) {
              const standardError = ErrorFactory.fromQuickBooksAPI(err, 'qb_company_info');
              reject(standardError);
            }
            else {
              // Get company info to include in response
              const companyInfo = broker.getLastUsedCompanyInfo();
              
              resolve({
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    _context: {
                      company_name: companyInfo?.companyName || data?.CompanyName || 'Unknown Company',
                      realm_id: companyInfo?.realmId || qbo.realmId,
                      _instruction: `This is company information for "${companyInfo?.companyName || data?.CompanyName || 'the QuickBooks company'}" (Realm ID: ${companyInfo?.realmId || qbo.realmId})`,
                      _metadata_note: 'IMPORTANT: MetaData.CreateTime is when the QuickBooks account was created, NOT when the business was founded. Look for CompanyStartDate or similar fields for actual business formation date.'
                    },
                    data: data
                  }, null, 2)
                }]
              });
            }
          });
        });
      } catch (error) {
        // Re-throw SUMmon errors as-is
        if (issummonError(error)) {
          throw error;
        }

        // Convert to tool execution error
        throw ErrorFactory.fromToolExecution(error, 'qb_company_info');
      }
    })
  });

  // Register list companies tool (no auth required - lists already authenticated companies)
  mcp.addTool({
    name: 'qb_list_companies',
    description: 'List all connected QuickBooks companies',
    parameters: z.object({}),
    execute: async () => {
      try {
        const companies = await broker.listCompanies();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              _context: {
                _instruction: companies.length === 0 
                  ? 'No QuickBooks companies are currently connected. Use the authenticate tool to connect to QuickBooks.'
                  : companies.length === 1
                  ? `Currently connected to one QuickBooks company: "${companies[0].name}" (Realm ID: ${companies[0].realmId}). When performing operations, always mention this company name.`
                  : `Connected to ${companies.length} QuickBooks companies. When performing operations, always specify which company you're working with: ${companies.map(c => `"${c.name}" (Realm ID: ${c.realmId})`).join(', ')}.`
              },
              companies: companies
            }, null, 2)
          }]
        };
      } catch (error) {
        // Re-throw SUMmon errors as-is
        if (issummonError(error)) {
          throw error;
        }

        // Convert to tool execution error
        throw ErrorFactory.fromToolExecution(error, 'qb_list_companies');
      }
    }
  });

  // Register the unified report tool
  mcp.addTool({
    name: 'qb_report',
    description: 'Generate various QuickBooks reports - CRITICAL: Always clearly identify which company\'s report you\'re presenting. Check _context field for company details.',
    parameters: z.object({
      realmId: z.string().optional().describe('The realm ID of the QuickBooks company to query'),
      reportType: z.enum(Object.keys(reportTypes) as [string, ...string[]]).describe('Type of report to generate'),
      startDate: z.string().describe('Start date for the report (ISO format)'),
      endDate: z.string().describe('End date for the report (ISO format)'),
      summarizeBy: z.enum(['Total', 'Month', 'Week', 'Days']).optional().describe('How to summarize the report (for P&L and similar reports)'),
      accountingMethod: z.enum(['Cash', 'Accrual']).optional().describe('Accounting method for the report')
    }),
    execute: withAuth(async (args) => {
      try {
        const qbo = await broker.getQBOClient(args.realmId);

        // Get the SDK method name
        const sdkMethodName = reportTypes[args.reportType as keyof typeof reportTypes];
        const reportMethod = (qbo as any)[sdkMethodName];

        if (!reportMethod) {
          throw new Error(`Report type ${args.reportType} not supported`);
        }

        // Build report parameters
        const reportParams: any = {
          start_date: args.startDate,
          end_date: args.endDate
        };

        // Add optional parameters if provided
        if (args.summarizeBy) {
          reportParams.summarize_column_by = args.summarizeBy;
        }
        if (args.accountingMethod) {
          reportParams.accounting_method = args.accountingMethod;
        }

        return new Promise((resolve, reject) => {
          reportMethod.call(qbo, reportParams, (err: any, data: any) => {
            if (err) {
              const standardError = ErrorFactory.fromQuickBooksAPI(err, 'qb_report');
              reject(standardError);
            }
            else {
              // Get company info to include in response
              const companyInfo = broker.getLastUsedCompanyInfo();
              
              resolve({
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    _context: {
                      company_name: companyInfo?.companyName || 'Unknown Company',
                      realm_id: companyInfo?.realmId || qbo.realmId,
                      report_type: args.reportType,
                      period: `${args.startDate} to ${args.endDate}`,
                      _instruction: `This is a ${args.reportType.replace(/_/g, ' ')} report for "${companyInfo?.companyName || 'the QuickBooks company'}" (Realm ID: ${companyInfo?.realmId || qbo.realmId}) covering the period from ${args.startDate} to ${args.endDate}`
                    },
                    data: data
                  }, null, 2)
                }]
              });
            }
          });
        });
      } catch (error) {
        // Re-throw SUMmon errors as-is
        if (issummonError(error)) {
          throw error;
        }

        // Convert to tool execution error
        throw ErrorFactory.fromToolExecution(error, 'qb_report');
      }
    })
  });

  // Register transaction search tool
  mcp.addTool({
    name: 'qb_search_transactions',
    description: 'Search for transactions across multiple types using flexible search terms and account filters. Perfect for finding payments to specific vendors (e.g., IRS, tax payments), transactions with specific keywords, or transactions using specific accounts.',
    parameters: searchTransactionsSchema,
    execute: withAuth(async (args) => {
      try {
        const qbo = await broker.getQBOClient(args.realmId);
        
        // Perform the search
        const results = await searchTransactions(qbo, args);
        
        // Generate summary
        const summary = generateSearchSummary(results, args.searchTerms);
        
        // Get company info
        const companyInfo = broker.getLastUsedCompanyInfo();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              _context: {
                company_name: companyInfo?.companyName || 'Unknown Company',
                realm_id: companyInfo?.realmId || qbo.realmId,
                search_terms: args.searchTerms,
                account_filters: args.accountNames || [],
                date_range: args.startDate || args.endDate ? `${args.startDate || 'beginning'} to ${args.endDate || 'now'}` : 'all dates',
                _instruction: `Searched ${companyInfo?.companyName || 'the QuickBooks company'} for transactions matching: ${args.searchTerms.join(', ')}${args.accountNames ? ` and using accounts: ${args.accountNames.join(', ')}` : ''}`
              },
              summary: summary,
              results: results
            }, null, 2)
          }]
        };
      } catch (error) {
        // Re-throw SUMmon errors as-is
        if (issummonError(error)) {
          throw error;
        }

        // Convert to tool execution error
        throw ErrorFactory.fromToolExecution(error, 'qb_search_transactions');
      }
    })
  });
}
