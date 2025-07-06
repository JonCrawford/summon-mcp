import 'dotenv/config';
import { FastMCP } from 'fastmcp';
import { z } from 'zod';

console.error('=== Minimal QuickBooks Server Debug ===');

const mcp = new FastMCP({
  name: 'quickbooks-mcp',
  version: '1.0.0'
});

console.error('FastMCP created');

// Only add health check tool
mcp.addTool({
  name: 'health_check',
  description: 'Check if the server is running',
  parameters: z.object({}),
  execute: async () => {
    return { content: [{ type: 'text', text: 'OK' }] };
  }
});

console.error('Health check tool added');

// Add resource and prompt (these were needed for FastMCP)
mcp.addResource({
  name: 'Server Info',
  description: 'Information about this QuickBooks MCP server',
  uri: 'internal://server-info',
  mimeType: 'application/json',
  load: async () => ({
    text: JSON.stringify({
      name: 'QuickBooks MCP Server',
      version: '1.0.0',
      description: 'MCP server for QuickBooks Online integration',
      capabilities: ['tools', 'oauth']
    }, null, 2)
  })
});

mcp.addPrompt({
  name: 'quickbooks-query-help',
  description: 'Help with QuickBooks queries and available tools',
  arguments: [],
  load: async () => 'I can help you query QuickBooks Online data.'
});

console.error('Resource and prompt added');

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

console.error('Starting server...');

mcp.start({
  transportType: 'stdio'
}).then(() => {
  console.error('Server started successfully');
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});