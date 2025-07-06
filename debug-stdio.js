import 'dotenv/config';
import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { registerQuickBooksTools } from './dist/tools/index.js';

console.error('Starting stdio debug test...');

const mcp = new FastMCP({
  name: 'quickbooks-mcp',
  version: '1.0.0'
});

console.error('Adding basic tools...');

mcp.addTool({
  name: 'health_check',
  description: 'Check if the server is running',
  parameters: z.object({}),
  execute: async () => {
    return { content: [{ type: 'text', text: 'OK' }] };
  }
});

mcp.addResource({
  name: 'Server Info',
  description: 'Information about this QuickBooks MCP server',
  uri: 'internal://server-info',
  mimeType: 'application/json',
  load: async () => ({
    text: JSON.stringify({
      name: 'QuickBooks MCP Server',
      version: '1.0.0'
    }, null, 2)
  })
});

mcp.addPrompt({
  name: 'quickbooks-query-help',
  description: 'Help with QuickBooks queries and available tools',
  arguments: [],
  load: async () => 'Help text'
});

console.error('Registering QuickBooks tools...');
registerQuickBooksTools(mcp);
console.error('QuickBooks tools registered');

console.error('About to call mcp.start()...');

setTimeout(() => {
  console.error('5 second timeout - if you see this, the process is hung');
  process.exit(1);
}, 5000);

try {
  const result = mcp.start({
    transportType: 'stdio'
  });
  
  console.error('mcp.start() returned:', typeof result);
  
  result.then(() => {
    console.error('SUCCESS: Server started');
  }).catch((error) => {
    console.error('ERROR: Server failed to start:', error);
    process.exit(1);
  });
} catch (syncError) {
  console.error('SYNC ERROR in mcp.start():', syncError);
  process.exit(1);
}