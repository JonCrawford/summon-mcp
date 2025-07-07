import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { entities } from './entities.js';
import { QuickBooksBroker } from '../quickbooks-broker-mt.js';
import { withAuth } from './auth-wrapper.js';

// Common parameters for all QuickBooks list tools
const listParametersSchema = z.object({
  companyName: z.string().optional().describe('The name of the QuickBooks company to query'),
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
      description: entity.description,
      parameters: listParametersSchema,
      execute: withAuth(async (args) => {
        try {
          // Get authenticated QuickBooks client for the specified company
          const qbo = await broker.getQBOClient(args.companyName);
          
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
                // Handle specific error cases
                if (err.authData && err.authData.statusCode === 401) {
                  reject(new Error('Authentication failed. Please reconnect to QuickBooks using the authenticate tool'));
                } else if (err.statusCode === 429) {
                  reject(new Error('Rate limit exceeded. Please try again later.'));
                } else {
                  reject(new Error(`Failed to fetch ${entity.name}s: ${err.message || JSON.stringify(err)}`));
                }
              }
              else {
                // Return the data as JSON string for MCP
                resolve({
                  content: [{
                    type: 'text',
                    text: JSON.stringify(data, null, 2)
                  }]
                });
              }
            });
          });
        }
        catch (error) {
          // Handle errors that occur before the SDK call
          if (error instanceof Error) {
            throw error;
          }
          throw new Error(`Failed to execute ${entity.name} query: ${error}`);
        }
      })
    });
  });
  
  // Register CompanyInfo tool
  mcp.addTool({
    name: 'qb_company_info',
    description: 'Get QuickBooks company information',
    parameters: z.object({
        companyName: z.string().optional().describe('The name of the QuickBooks company to query')
    }),
    execute: withAuth(async (args) => {
      try {
        const qbo = await broker.getQBOClient(args.companyName);
        
        return new Promise((resolve, reject) => {
          // QuickBooks CompanyInfo typically has ID of 1
          (qbo as any).getCompanyInfo(qbo.realmId, (err: any, data: any) => {
            if (err) {
                  reject(new Error(`Failed to fetch company info: ${err.message || JSON.stringify(err)}`));
            }
            else {
              resolve({
                content: [{
                  type: 'text',
                  text: JSON.stringify(data, null, 2)
                }]
              });
            }
          });
        });
      }
      catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(`Failed to get company info: ${error}`);
      }
    })
  });
  
  // Register the unified report tool
  mcp.addTool({
    name: 'qb_report',
    description: 'Generate various QuickBooks reports',
    parameters: z.object({
      companyName: z.string().optional().describe('The name of the QuickBooks company to query'),
      reportType: z.enum(Object.keys(reportTypes) as [string, ...string[]]).describe('Type of report to generate'),
      startDate: z.string().describe('Start date for the report (ISO format)'),
      endDate: z.string().describe('End date for the report (ISO format)'),
      summarizeBy: z.enum(['Total', 'Month', 'Week', 'Days']).optional().describe('How to summarize the report (for P&L and similar reports)'),
      accountingMethod: z.enum(['Cash', 'Accrual']).optional().describe('Accounting method for the report')
    }),
    execute: withAuth(async (args) => {
      try {
        const qbo = await broker.getQBOClient(args.companyName);
        
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
              if (err.authData && err.authData.statusCode === 401) {
                reject(new Error('Authentication failed. Please reconnect to QuickBooks using the authenticate tool'));
              } else if (err.statusCode === 429) {
                reject(new Error('Rate limit exceeded. Please try again later.'));
              } else {
                reject(new Error(`Failed to generate ${args.reportType} report: ${err.message || err}`));
              }
            }
            else {
              resolve({
                content: [{
                  type: 'text',
                  text: JSON.stringify(data, null, 2)
                }]
              });
            }
          });
        });
      }
      catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(`Failed to generate report: ${error}`);
      }
    })
  });
}