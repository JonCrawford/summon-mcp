import 'dotenv/config';
import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { QuickBooksBroker } from './quickbooks-broker.js';
import { registerQuickBooksToolsWithBroker } from './tools/index-broker.js';

// Debug logging to stderr (visible in Claude Desktop logs)
const debug = (message: string) => {
  if (process.env.enableDebugLogging === 'true') {
    console.error(`[QuickBooks MCP] ${new Date().toISOString()} - ${message}`);
  }
};

debug('Starting QuickBooks MCP Server with broker architecture...');

// Get configuration from environment (injected by DXT)
const config = {
  brokerApiUrl: process.env.brokerApiUrl || '',
  brokerApiToken: process.env.brokerApiToken || '',
  defaultCompany: process.env.defaultCompany,
  cacheTTL: process.env.cacheTTL ? parseInt(process.env.cacheTTL) : 24,
  enableDebugLogging: process.env.enableDebugLogging === 'true'
};

// Validate required configuration
if (!config.brokerApiUrl || !config.brokerApiToken) {
  console.error('[QuickBooks MCP] ERROR: Missing required configuration. Please configure brokerApiUrl and brokerApiToken.');
  process.exit(1);
}

debug(`Configuration loaded: brokerApiUrl=${config.brokerApiUrl}, defaultCompany=${config.defaultCompany || 'none'}, cacheTTL=${config.cacheTTL}h`);

// Initialize FastMCP server
const mcp = new FastMCP({
  name: 'quickbooks-mcp',
  version: '2.0.0'
});

// Add health check tool
mcp.addTool({
  name: 'health_check',
  description: 'Check if the QuickBooks MCP server is running and broker is accessible',
  parameters: z.object({}),
  execute: async () => {
    try {
      // Create temporary broker instance for health check
      const broker = new QuickBooksBroker(config);
      const brokerHealthy = await broker.checkBrokerHealth();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'healthy',
            server: {
              name: 'quickbooks-mcp',
              version: '2.0.0',
              mode: 'broker'
            },
            broker: {
              url: config.brokerApiUrl,
              status: brokerHealthy ? 'connected' : 'unreachable'
            },
            cache: {
              ttl: `${config.cacheTTL} hours`
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
          }, null, 2)
        }]
      };
    }
  }
});

// Add server info resource
mcp.addResource({
  name: 'Server Info',
  description: 'Information about this QuickBooks MCP server',
  uri: 'quickbooks://server-info',
  mimeType: 'application/json',
  load: async () => ({
    text: JSON.stringify({
      name: 'QuickBooks MCP Server',
      version: '2.0.0',
      description: 'Multi-tenant QuickBooks Online integration',
      mode: 'broker',
      capabilities: {
        tools: true,
        oauth: false, // OAuth handled by broker
        multiTenant: true,
        caching: true
      },
      broker: {
        url: config.brokerApiUrl,
        configured: true
      }
    }, null, 2)
  })
});

// Add help prompt
mcp.addPrompt({
  name: 'quickbooks-query-help',
  description: 'Help with QuickBooks queries and available tools',
  arguments: [],
  load: async () => `
I can help you query QuickBooks Online data from multiple companies. 

**Available tools:**
- qb_list_companies - List all connected QuickBooks companies
- qb_list_customers - List customers from a company
- qb_list_invoices - List invoices
- qb_list_payments - List payments
- qb_report - Generate financial reports
- qb_cache_refresh - Force refresh cached data
- qb_cache_stats - View cache performance

**Multi-company usage:**
- If you have one company, it's used automatically
- For multiple companies, specify the company name: "Show Acme Corp's invoices"
- Or use the company parameter: company: "Acme Corp"

**Performance tips:**
- Data is cached for ${config.cacheTTL} hours to improve speed
- Use qb_cache_refresh to force fresh data
- Use qb_cache_stats to monitor performance

Start by using qb_list_companies to see available companies.
`
});

// Initialize QuickBooks broker
try {
  debug('Initializing QuickBooks broker...');
  const broker = new QuickBooksBroker(config);
  
  // Register all QuickBooks tools
  debug('Registering QuickBooks tools...');
  registerQuickBooksToolsWithBroker(mcp, broker);
  
  debug('All tools registered successfully');
} catch (error) {
  console.error('[QuickBooks MCP] ERROR: Failed to initialize broker:', error);
  process.exit(1);
}

// Start server with stdio transport
debug('Starting MCP server with stdio transport...');

mcp.start({
  transportType: 'stdio'
}).then(() => {
  debug('MCP server started successfully');
}).catch((error) => {
  console.error('[QuickBooks MCP] ERROR: Failed to start MCP server:', error);
  process.exit(1);
});