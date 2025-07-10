/**
 * QuickBooks Resources - MCP Resource Implementation
 * 
 * Resources provide read-only access to QuickBooks data without side effects.
 * URI scheme: qb://[entity][?parameters]
 */

import { FastMCP } from 'fastmcp';
import { getQBOClient, listCompanies, clearClientCache } from '../quickbooks-broker-adapter.js';
import { entities } from '../tools/entities.js';
import { reportTypes } from './report-types.js';

export interface ResourceHandler {
  name: string;
  description: string;
  uriPattern: string;
  mimeType: string;
  handler: (uri: string, params: URLSearchParams) => Promise<string>;
}

/**
 * Handle automatic token refresh when encountering 401 errors
 */
async function handleTokenRefresh(
  entity: string,
  queryParams: any,
  sdkFunction: any,
  resolve: (value: string) => void,
  reject: (reason?: any) => void
): Promise<void> {
  try {
    console.error(`Token expired for ${entity}, attempting refresh...`);
    
    // Clear cached client to force recreation with new tokens
    clearClientCache();
    
    // Try to get a fresh client (this should trigger token refresh)
    const refreshedQBO = await getQBOClient();
    
    // Retry the API call with refreshed client
    sdkFunction.call(refreshedQBO, queryParams, (err: any, data: any) => {
      if (err) {
        if (err.authData && err.authData.statusCode === 401) {
          // Refresh failed, now we really need re-auth
          reject(new Error(JSON.stringify({
            error: 'AUTHENTICATION_EXPIRED',
            message: 'Authentication failed. Please reconnect to QuickBooks.',
            needsReauth: true,
            details: 'Your QuickBooks refresh token has expired. Use the authenticate tool to reconnect.'
          })));
        } else {
          reject(new Error(`Failed to fetch ${entity} after token refresh: ${err.message || JSON.stringify(err)}`));
        }
      } else {
        console.error(`Token refresh successful for ${entity}`);
        resolve(JSON.stringify(data, null, 2));
      }
    });
  } catch (refreshError) {
    // Token refresh failed completely
    reject(new Error(JSON.stringify({
      error: 'AUTHENTICATION_EXPIRED',
      message: 'Authentication failed. Please reconnect to QuickBooks.',
      needsReauth: true,
      details: 'Unable to refresh your QuickBooks token. Use the authenticate tool to reconnect.'
    })));
  }
}


/**
 * Generic QuickBooks entity resource handler
 */
async function handleEntityResource(entity: string, params: URLSearchParams, realmId?: string): Promise<string> {
  try {
    // Find the entity configuration
    const entityConfig = entities.find(e => e.name === entity);
    if (!entityConfig) {
      throw new Error(`Unknown entity: ${entity}`);
    }

    // Get authenticated QuickBooks client
    const qbo = await getQBOClient(realmId);
    
    // Build query parameters
    const queryParams: any = {
      limit: parseInt(params.get('limit') || '20')
    };
    
    // Add date filtering if provided
    const startDate = params.get('startDate');
    const endDate = params.get('endDate');
    if (startDate || endDate) {
      const dateFilter = [];
      if (startDate) {
        dateFilter.push(`MetaData.CreateTime>='${startDate}'`);
      }
      if (endDate) {
        dateFilter.push(`MetaData.CreateTime<='${endDate}'`);
      }
      queryParams.query = dateFilter.join(' AND ');
    }
    
    // Call the appropriate SDK function
    const sdkFunction = (qbo as any)[entityConfig.sdkFn];
    if (!sdkFunction) {
      throw new Error(`SDK function ${entityConfig.sdkFn} not found`);
    }
    
    // Execute the query and return results
    return new Promise(async (resolve, reject) => {
      const executeCall = () => {
        sdkFunction.call(qbo, queryParams, (err: any, data: any) => {
          if (err) {
            // Handle specific error cases
            if (err.authData && err.authData.statusCode === 401) {
              // Token expired - try to refresh automatically
              handleTokenRefresh(entity, queryParams, sdkFunction, resolve, reject);
            } else if (err.statusCode === 429) {
              reject(new Error('Rate limit exceeded. Please try again later.'));
            } else {
              reject(new Error(`Failed to fetch ${entity}: ${err.message || JSON.stringify(err)}`));
            }
          } else {
            resolve(JSON.stringify(data, null, 2));
          }
        });
      };
      
      executeCall();
    });
  } catch (error) {
    throw new Error(`Failed to process ${entity} resource: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Handle company info resource
 */
async function handleCompanyInfoResource(realmId?: string): Promise<string> {
  try {
    const qbo = await getQBOClient(realmId);
    
    return new Promise(async (resolve, reject) => {
      const executeCall = (qboClient: any) => {
        (qboClient as any).getCompanyInfo(qboClient.realmId, (err: any, data: any) => {
          if (err) {
            if (err.authData && err.authData.statusCode === 401) {
              // Try to refresh token automatically
              const sdkFunction = (qbo: any) => (qbo as any).getCompanyInfo;
              handleTokenRefresh('company-info', qboClient.realmId, sdkFunction, resolve, reject);
            } else {
              reject(new Error(`Failed to fetch company info: ${err.message || JSON.stringify(err)}`));
            }
          } else {
            resolve(JSON.stringify(data, null, 2));
          }
        });
      };
      
      executeCall(qbo);
    });
  } catch (error) {
    throw new Error(`Failed to get company info: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Handle companies list resource
 */
async function handleCompaniesResource(): Promise<string> {
  try {
    const companies = await listCompanies();
    return JSON.stringify(companies, null, 2);
  } catch (error) {
    throw new Error(`Failed to list companies: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Handle report resources
 */
async function handleReportResource(reportType: string, params: URLSearchParams, realmId?: string): Promise<string> {
  try {
    // Validate report type
    if (!(reportType in reportTypes)) {
      throw new Error(`Unknown report type: ${reportType}. Available: ${Object.keys(reportTypes).join(', ')}`);
    }

    const qbo = await getQBOClient(realmId);
    
    // Get the SDK method name
    const sdkMethodName = reportTypes[reportType as keyof typeof reportTypes];
    const reportMethod = (qbo as any)[sdkMethodName];
    
    if (!reportMethod) {
      throw new Error(`Report method ${sdkMethodName} not found in SDK`);
    }
    
    // Build report parameters
    const reportParams: any = {
      start_date: params.get('startDate') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      end_date: params.get('endDate') || new Date().toISOString().split('T')[0]
    };
    
    // Add optional parameters if provided
    const summarizeBy = params.get('summarizeBy');
    if (summarizeBy) {
      reportParams.summarize_column_by = summarizeBy;
    }
    
    const accountingMethod = params.get('accountingMethod');
    if (accountingMethod) {
      reportParams.accounting_method = accountingMethod;
    }
    
    return new Promise((resolve, reject) => {
      reportMethod.call(qbo, reportParams, (err: any, data: any) => {
        if (err) {
          if (err.authData && err.authData.statusCode === 401) {
            // Try to refresh token automatically
            handleTokenRefresh(`${reportType}-report`, reportParams, reportMethod, resolve, reject);
          } else if (err.statusCode === 429) {
            reject(new Error('Rate limit exceeded. Please try again later.'));
          } else {
            reject(new Error(`Failed to generate ${reportType} report: ${err.message || err}`));
          }
        } else {
          resolve(JSON.stringify(data, null, 2));
        }
      });
    });
  } catch (error) {
    throw new Error(`Failed to generate report: ${error instanceof Error ? error.message : error}`);
  }
}


/**
 * Register all QuickBooks resources with the MCP server
 */
export function registerQuickBooksResources(mcp: FastMCP): void {
  
  // Register company list resource
  mcp.addResource({
    name: 'QuickBooks Companies',
    description: 'List of available QuickBooks companies',
    uri: 'qb://companies',
    mimeType: 'application/json',
    load: async () => ({
      text: await handleCompaniesResource()
    })
  });

  // Register company info resource template
  mcp.addResourceTemplate({
    name: 'Company Information',
    description: 'QuickBooks company information and settings',
    uriTemplate: 'qb://company/info{?realmId}',
    mimeType: 'application/json',
    arguments: [
      { name: 'realmId', description: 'Realm ID of the QuickBooks company (defaults to first available)', required: false }
    ],
    load: async (args) => {
      return {
        text: await handleCompanyInfoResource((args as any).realmId)
      };
    }
  });

  // Register entity resources for each QuickBooks entity
  entities.forEach(entity => {
    mcp.addResourceTemplate({
      name: `QuickBooks ${entity.name.charAt(0).toUpperCase() + entity.name.slice(1)}`,
      description: `${entity.description}`,
      uriTemplate: `qb://${entity.name}{?companyName,limit,startDate,endDate}`,
      mimeType: 'application/json',
      arguments: [
        { name: 'realmId', description: 'Realm ID of the QuickBooks company (defaults to first available)', required: false },
        { name: 'limit', description: 'Maximum number of records to return', required: false },
        { name: 'startDate', description: 'Start date for filtering (YYYY-MM-DD)', required: false },
        { name: 'endDate', description: 'End date for filtering (YYYY-MM-DD)', required: false }
      ],
      load: async (args) => {
        // Convert args to URLSearchParams for compatibility
        const params = new URLSearchParams();
        Object.entries(args).forEach(([key, value]) => {
          if (value !== undefined && key !== 'realmId') {
            params.set(key, value);
          }
        });
        
        // TODO: Update handleEntityResource to accept company name
        // For now, it will use the first available company
        return {
          text: await handleEntityResource(entity.name, params)
        };
      }
    });
  });

  // Register report resources
  Object.keys(reportTypes).forEach(reportType => {
    mcp.addResourceTemplate({
      name: `${reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Report`,
      description: `QuickBooks ${reportType} report`,
      uriTemplate: `qb://reports/${reportType}{?companyName,startDate,endDate,summarizeBy,accountingMethod}`,
      mimeType: 'application/json',
      arguments: [
        { name: 'realmId', description: 'Realm ID of the QuickBooks company (defaults to first available)', required: false },
        { name: 'startDate', description: 'Start date for the report (YYYY-MM-DD)', required: false },
        { name: 'endDate', description: 'End date for the report (YYYY-MM-DD)', required: false },
        { name: 'summarizeBy', description: 'How to summarize the report (Month, Week, Day)', required: false },
        { name: 'accountingMethod', description: 'Accounting method (Cash or Accrual)', required: false }
      ],
      load: async (args) => {
        // Convert args to URLSearchParams for compatibility
        const params = new URLSearchParams();
        Object.entries(args).forEach(([key, value]) => {
          if (value !== undefined && key !== 'realmId') {
            params.set(key, value);
          }
        });
        
        return {
          text: await handleReportResource(reportType, params, args.realmId)
        };
      }
    });
  });

  // Add auth status resource
  mcp.addResource({
    name: 'Authentication Status',
    description: 'Current QuickBooks authentication status and connection information',
    uri: 'qb://auth/status',
    mimeType: 'application/json',
    load: async () => {
      try {
        // Try to get QB client AND make an actual API call to verify tokens
        const qbo = await getQBOClient();
        
        // Test the connection with a lightweight API call
        return new Promise((resolve) => {
          (qbo as any).getCompanyInfo(qbo.realmId, (err: any, data: any) => {
            if (err) {
              // API call failed - tokens are invalid/expired
              resolve({
                text: JSON.stringify({
                  authenticated: false,
                  status: 'Token expired or invalid',
                  error: err.authData?.statusCode === 401 ? 'Authentication failed. Please reconnect to QuickBooks.' : `API Error: ${err.message || err}`,
                  needsReauth: true,
                  timestamp: new Date().toISOString()
                }, null, 2)
              });
            } else {
              // API call succeeded - tokens are valid
              resolve({
                text: JSON.stringify({
                  authenticated: true,
                  status: 'Connected to QuickBooks',
                  companyName: data?.QueryResponse?.CompanyInfo?.[0]?.CompanyName || 'Unknown',
                  realmId: qbo.realmId,
                  timestamp: new Date().toISOString()
                }, null, 2)
              });
            }
          });
        });
      } catch (error) {
        return {
          text: JSON.stringify({
            authenticated: false,
            status: 'Not authenticated',
            error: error instanceof Error ? error.message : String(error),
            needsAuth: true,
            timestamp: new Date().toISOString()
          }, null, 2)
        };
      }
    }
  });

  // Add metadata resource for available entities
  mcp.addResource({
    name: 'QuickBooks Metadata',
    description: 'Available entities, reports, and API capabilities',
    uri: 'qb://metadata',
    mimeType: 'application/json',
    load: async () => ({
      text: JSON.stringify({
        entities: entities.map(e => ({
          name: e.name,
          description: e.description,
          uri: `qb://${e.name}`,
          supportedParameters: ['startDate', 'endDate', 'limit']
        })),
        reports: Object.keys(reportTypes).map(type => ({
          name: type,
          uri: `qb://reports/${type}`,
          supportedParameters: ['startDate', 'endDate', 'summarizeBy', 'accountingMethod']
        })),
        company: {
          info: {
            uri: 'qb://company/info',
            description: 'Company information and settings'
          }
        },
        auth: {
          status: {
            uri: 'qb://auth/status',
            description: 'Authentication status and connection info'
          }
        }
      }, null, 2)
    })
  });
}