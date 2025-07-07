/**
 * DXT-Compatible Server Entry Point
 * 
 * This server is designed to run in the read-only DXT environment.
 * - No OAuth client instantiation on startup
 * - No file system writes
 * - All configuration from environment variables
 * - Logging only to stderr
 */

import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { TokenStorage } from './token-storage.js';
import { TokenManager } from './token-manager.js';
import { QuickBooksBroker } from './quickbooks-broker-mt.js';
import { registerQuickBooksTools } from './tools/index.js';
import { logger } from './logger.js';

// Disable file logging for DXT environment
process.env.DXT_ENVIRONMENT = 'true';

// Initialize logger without file path to use stderr only
logger.info('QuickBooks MCP Server (DXT Broker) starting...');
logger.info(`Node version: ${process.version}`);
logger.info(`Environment: DXT`);

// Initialize FastMCP server
const mcp = new FastMCP({
  name: 'quickbooks-mcp',
  version: '2.0.1'
});

// Track initialization state
let initializationError: Error | null = null;
let tokenManager: TokenManager | null = null;
let qbBroker: QuickBooksBroker | null = null;

// Initialize components
try {
  tokenManager = new TokenManager();
  qbBroker = new QuickBooksBroker(tokenManager);
} catch (error) {
  initializationError = error as Error;
  logger.error('Failed to initialize QuickBooks components', error);
}

// Add health check tool
mcp.addTool({
  name: 'health_check',
  description: 'Check if the QuickBooks MCP server is running and responsive',
  parameters: z.object({}),
  execute: async () => {
    const storage = new TokenStorage();
    const hasCredentials = storage.hasOAuthCredentials();
    const hasToken = tokenManager ? await tokenManager.hasRefreshToken() : false;
    
    let status = 'Server is running';
    const details: string[] = [];
    
    if (initializationError) {
      status = 'Server running with initialization errors';
      details.push(`Initialization error: ${initializationError.message}`);
    }
    
    if (!hasCredentials) {
      details.push('OAuth credentials not configured');
    }
    
    if (!hasToken) {
      details.push('Not authenticated with QuickBooks');
    } else {
      details.push('Authenticated with QuickBooks');
    }
    
    return {
      content: [{
        type: 'text',
        text: `${status}\n${details.join('\n')}`
      }]
    };
  }
});

// Add authentication tool
mcp.addTool({
  name: 'authenticate',
  description: 'Start QuickBooks OAuth authentication flow',
  parameters: z.object({
    force: z.boolean().optional().describe('Force re-authentication even if already connected')
  }),
  execute: async (args) => {
    if (!qbBroker) {
      throw new Error('QuickBooks broker not initialized');
    }
    
    const result = await qbBroker.authenticate(args.force);
    return {
      content: [{
        type: 'text',
        text: result
      }]
    };
  }
});

// Add clear auth tool
mcp.addTool({
  name: 'clear_auth',
  description: 'Clear stored QuickBooks authentication tokens and disconnect',
  parameters: z.object({
    confirm: z.boolean().optional().describe('Confirm that you want to clear authentication')
  }),
  execute: async (args) => {
    if (!args.confirm) {
      return {
        content: [{
          type: 'text',
          text: 'Please confirm you want to clear authentication by setting confirm: true'
        }]
      };
    }
    
    if (!tokenManager) {
      throw new Error('Token manager not initialized');
    }
    
    await tokenManager.clearTokens();
    return {
      content: [{
        type: 'text',
        text: 'QuickBooks authentication cleared successfully'
      }]
    };
  }
});

// Add minimal resource to ensure resources/list endpoint exists
mcp.addResource({
  name: 'Server Info',
  description: 'Information about the QuickBooks MCP server',
  uri: 'quickbooks://server-info',
  mimeType: 'application/json',
  load: async () => ({
    text: JSON.stringify({
      name: 'QuickBooks MCP Server',
      version: '2.0.1',
      environment: 'DXT',
      description: 'MCP server for QuickBooks Online integration',
      capabilities: ['tools', 'resources', 'prompts'],
      status: {
        initialized: !initializationError,
        hasCredentials: new TokenStorage().hasOAuthCredentials(),
        initializationError: initializationError?.message || null
      }
    }, null, 2)
  })
});

// Add help prompt to ensure prompts/list endpoint exists
mcp.addPrompt({
  name: 'quickbooks-help',
  description: 'Get help with QuickBooks MCP tools and features',
  arguments: [],
  load: async () => `
QuickBooks MCP Server Help

This server provides integration with QuickBooks Online through the MCP protocol.

Available tools:
- health_check: Check server status and connection
- authenticate: Connect to QuickBooks (requires OAuth setup)
- clear_auth: Disconnect from QuickBooks
- qb_list_<entity>: List various QuickBooks entities (customers, invoices, etc.)
- qb_report: Generate QuickBooks reports

Setup:
1. Configure OAuth credentials as environment variables or in Claude Desktop
2. Use 'authenticate' tool to connect to QuickBooks
3. Use entity tools to query data

For detailed setup instructions, see the project README.
`
});

// Add list companies tool
mcp.addTool({
  name: 'qb_list_companies',
  description: 'List all connected QuickBooks companies',
  parameters: z.object({}),
  execute: async () => {
    if (!qbBroker) {
      throw new Error('QuickBooks broker not initialized');
    }
    
    const companies = await qbBroker.listCompanies();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(companies, null, 2)
      }]
    };
  }
});

// Register QuickBooks tools if broker is available
if (qbBroker && !initializationError) {
  try {
    registerQuickBooksTools(mcp, qbBroker);
    logger.info('QuickBooks tools registered successfully');
  } catch (error) {
    logger.error('Failed to register QuickBooks tools', error);
    // Continue running - tools just won't be available
  }
}

// Handle process signals gracefully
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT signal');
  process.exit(0);
});

// Start server
mcp.start({ transportType: 'stdio' })
  .then(() => {
    logger.info('QuickBooks MCP server started successfully on stdio transport');
  })
  .catch((error) => {
    logger.error('Failed to start MCP server', error);
    // Wait briefly to ensure error is logged before exit
    setTimeout(() => process.exit(1), 100);
  });