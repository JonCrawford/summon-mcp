import { FastMCP } from 'fastmcp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerMinimalTools } from './tools/minimal-tools.js';
import { registerQuickBooksResources } from './resources/index.js';
import { registerQuickBooksPrompts } from './prompts/index.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Add file-based logging setup ---
const logFilePath = path.resolve(__dirname, '../mcp-server.log');
// Clear log file on start for clean debugging
try {
  if (fs.existsSync(logFilePath)) {
    fs.unlinkSync(logFilePath);
  }
} catch (error) {
  // Ignore if file doesn't exist or can't be removed
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

// Register minimal action-oriented tools
log('Registering minimal tools...');
try {
  registerMinimalTools(mcp);
  log('Minimal tools registered successfully');
} catch (error) {
  logError('Failed to register minimal tools', error);
  console.error('Failed to register minimal tools:', error);
}

// Register QuickBooks resources (data access)
log('Registering QuickBooks resources...');
try {
  registerQuickBooksResources(mcp);
  log('QuickBooks resources registered successfully');
} catch (error) {
  logError('Failed to register QuickBooks resources', error);
  console.error('Failed to register QuickBooks resources:', error);
}

// Register QuickBooks prompts (workflow templates)
log('Registering QuickBooks prompts...');
try {
  registerQuickBooksPrompts(mcp);
  log('QuickBooks prompts registered successfully');
} catch (error) {
  logError('Failed to register QuickBooks prompts', error);
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
      name: 'QuickBooks MCP Server',
      version: '1.0.0',
      description: 'MCP server for QuickBooks Online integration with resources, tools, and prompts',
      capabilities: ['tools', 'resources', 'prompts'],
      architecture: {
        tools: ['health_check', 'authenticate', 'clear_auth'],
        resources: ['qb://* (dynamic QuickBooks data)', 'qb://auth/status', 'qb://metadata'],
        prompts: ['analyze-financial-performance', 'review-customer-aging', 'monthly-close-checklist', 'setup-quickbooks-connection', 'analyze-sales-performance']
      }
    }, null, 2)
  })
});


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