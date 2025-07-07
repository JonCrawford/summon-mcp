/**
 * DXT-Compatible QuickBooks MCP Server
 * 
 * This server is designed to run in read-only DXT environments where:
 * - No file system writes are allowed
 * - All configuration comes from environment variables
 * - OAuth tokens must be managed externally or via DXT runtime
 */

import { FastMCP } from 'fastmcp';
import { registerMinimalTools } from './tools/minimal-tools.js';
import { registerQuickBooksResources } from './resources/index.js';
import { registerQuickBooksPrompts } from './prompts/index.js';

// Disable all file logging for DXT environment
process.env.QUICKBOOKS_NO_FILE_LOGGING = 'true';
process.env.NODE_ENV = 'production'; // Suppress debug logging from dependencies
process.env.DEBUG = ''; // Disable debug output

// Initialize FastMCP server
const mcp = new FastMCP({
  name: 'quickbooks-mcp',
  version: '1.0.0'
});

// Add debug logging to stderr only
console.error('QuickBooks MCP Server (DXT Mode) starting...');
console.error(`Environment: ${process.env.QUICKBOOKS_PRODUCTION === 'true' ? 'production' : 'sandbox'}`);

// Register minimal action-oriented tools
try {
  registerMinimalTools(mcp);
  console.error('Minimal tools registered successfully');
} catch (error) {
  console.error('Failed to register minimal tools:', error);
}

// Register QuickBooks resources (data access)
try {
  registerQuickBooksResources(mcp);
  console.error('QuickBooks resources registered successfully');
} catch (error) {
  console.error('Failed to register QuickBooks resources:', error);
}

// Register QuickBooks prompts (workflow templates)
try {
  registerQuickBooksPrompts(mcp);
  console.error('QuickBooks prompts registered successfully');
} catch (error) {
  console.error('Failed to register QuickBooks prompts:', error);
}

// Add server info resource
mcp.addResource({
  name: 'Server Info',
  description: 'Information about this QuickBooks MCP server',
  uri: 'internal://server-info',
  mimeType: 'application/json',
  load: async () => ({
    text: JSON.stringify({
      name: 'QuickBooks MCP Server (DXT Mode)',
      version: '1.0.0',
      description: 'MCP server for QuickBooks Online integration running in DXT mode',
      capabilities: ['tools', 'resources', 'prompts'],
      mode: 'dxt',
      environment: process.env.QUICKBOOKS_PRODUCTION === 'true' ? 'production' : 'sandbox',
      architecture: {
        tools: ['health_check', 'authenticate', 'clear_auth'],
        resources: ['qb://* (dynamic QuickBooks data)', 'qb://auth/status', 'qb://metadata'],
        prompts: ['analyze-financial-performance', 'review-customer-aging', 'monthly-close-checklist', 'setup-quickbooks-connection', 'analyze-sales-performance']
      }
    }, null, 2)
  })
});

// Handle uncaught exceptions without file logging
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server with stdio
mcp.start({
  transportType: 'stdio'
}).then(() => {
  console.error('QuickBooks MCP Server (DXT Mode) started successfully on stdio transport');
}).catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});