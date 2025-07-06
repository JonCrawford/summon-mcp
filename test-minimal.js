#!/usr/bin/env node

// Minimal test server to debug the crash
import { FastMCP } from 'fastmcp';
import { z } from 'zod';

console.error('Starting minimal test server...');

const mcp = new FastMCP({
  name: 'test-server',
  version: '1.0.0'
});

console.error('FastMCP created successfully');

mcp.addTool({
  name: 'test_tool',
  description: 'Test tool',
  parameters: z.object({}),
  execute: async () => {
    return { content: [{ type: 'text', text: 'OK' }] };
  }
});

console.error('Tool added successfully');

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in minimal test:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection in minimal test:', reason);
  process.exit(1);
});

console.error('Starting server...');

mcp.start({
  transportType: 'stdio'
}).then(() => {
  console.error('Minimal test server started successfully');
}).catch((error) => {
  console.error('Failed to start minimal test server:', error);
  process.exit(1);
});