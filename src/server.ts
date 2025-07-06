import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerQuickBooksTools } from './tools/index.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Add file-based logging setup ---
const logFilePath = path.resolve(__dirname, '../mcp-server.log');
// Clear log file on start for clean debugging
if (fs.existsSync(logFilePath)) {
  fs.unlinkSync(logFilePath);
}
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

const log = (message: string) => {
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] INFO: ${message}\n`);
};

const logError = (message: string, error?: any) => {
  const timestamp = new Date().toISOString();
  const errorString = error instanceof Error ? error.stack : JSON.stringify(error);
  const fullMessage = `[${timestamp}] ERROR: ${message}\n${errorString}\n`;
  logStream.write(fullMessage);
  console.error(fullMessage); // Keep console.error for inspector
};
// --- End of logging setup ---

// Add console.error for Claude Desktop debugging
console.error('--- QuickBooks MCP Server Debug Info ---');
console.error(`Current working directory: ${process.cwd()}`);
console.error(`__dirname: ${__dirname}`);
console.error(`Process arguments: ${JSON.stringify(process.argv)}`);

log('--- MCP Server Process Started ---');
log(`Current working directory: ${process.cwd()}`);
log(`NODE_ENV: ${process.env.NODE_ENV}`);
log(`Executing with node version: ${process.version}`);
log(`Process arguments: ${JSON.stringify(process.argv)}`);

// Initialize FastMCP server
const mcp = new FastMCP({
  name: 'quickbooks-mcp',
  version: '1.0.0'
});

// Add debug logging for FastMCP events
console.error('FastMCP instance created');

// Add health check tool
mcp.addTool({
  name: 'health_check',
  description: 'Check if the server is running',
  parameters: z.object({}),
  execute: async () => {
    return { content: [{ type: 'text', text: 'OK' }] };
  }
});

// Add minimal resource and prompt to ensure handlers are set up
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
      capabilities: ['tools']
    }, null, 2)
  })
});

mcp.addPrompt({
  name: 'quickbooks-query-help',
  description: 'Help with QuickBooks queries and available tools',
  arguments: [],
  load: async () => 'I can help you query QuickBooks Online data. Available tools include listing customers, invoices, payments, and generating reports. Use the health_check tool to verify server status.'
});

// Register all QuickBooks tools
log('Registering QuickBooks tools...');
try {
  registerQuickBooksTools(mcp);
  log('QuickBooks tools registered successfully');
} catch (error) {
  logError('Failed to register QuickBooks tools', error);
  console.error('Failed to register QuickBooks tools:', error);
  process.exit(1);
}

log('Starting MCP server with stdio transport...');

// Add process handlers for debugging
process.on('uncaughtException', (error) => {
  logError('Uncaught exception', error);
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled rejection', { reason, promise });
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Add SIGTERM and SIGINT handlers
process.on('SIGTERM', () => {
  log('Received SIGTERM signal');
  console.error('Received SIGTERM signal');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('Received SIGINT signal');
  console.error('Received SIGINT signal');
  process.exit(0);
});

// Start server with stdio
mcp.start({
  transportType: 'stdio'
}).then(() => {
  log('MCP server started successfully');
  console.error('MCP server started successfully on stdio transport');
  // The process will now be kept alive by fastmcp.
  // DO NOT add any process.stdin handlers here.
}).catch((error) => {
  logError('Failed to start MCP server', error);
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});