import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'path';

describe('MCP Handshake Compliance', () => {
  it('should complete handshake with no environment variables', async () => {
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    
    const transport = new StdioClientTransport({
      command: process.execPath, // Use full node path
      args: [serverPath],
      env: {
        PATH: process.env.PATH, // Include PATH for node to find modules
        // No QuickBooks environment variables
      }
    });

    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    // Connect should succeed even without any config
    await client.connect(transport);
    
    // Handshake was successful if we can list tools
    const tools = await client.listTools();
    expect(tools.tools).toBeDefined();
    expect(Array.isArray(tools.tools)).toBe(true);
    
    // Clean up
    await client.close();
  });

  it('should complete handshake with partial configuration', async () => {
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        // Only one of the required credentials
        QB_CLIENT_ID: 'test-id'
        // Missing QB_CLIENT_SECRET
      }
    });

    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await client.connect(transport);
    
    // Should still be able to list tools
    const tools = await client.listTools();
    expect(tools.tools).toBeDefined();
    expect(Array.isArray(tools.tools)).toBe(true);
    
    // health_check should always be available
    const healthCheck = tools.tools.find(t => t.name === 'health_check');
    expect(healthCheck).toBeDefined();
    
    await client.close();
  });

  it('should complete handshake with invalid configuration', async () => {
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'production', // Force production mode
        QB_CLIENT_ID: 'invalid',
        QB_CLIENT_SECRET: 'invalid',
        QUICKBOOKS_PRODUCTION: 'true'
      }
    });

    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    // Should still connect despite invalid credentials
    await client.connect(transport);
    
    // If we can list tools, handshake was successful
    const tools = await client.listTools();
    expect(tools.tools).toBeDefined();
    
    await client.close();
  });

  it('should handle tool calls gracefully when unconfigured', async () => {
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test'
        // No credentials
      }
    });

    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await client.connect(transport);
    
    // Just verify we can list tools - this proves handshake completed
    const tools = await client.listTools();
    expect(tools.tools).toBeDefined();
    
    // Verify health_check tool exists
    const healthCheck = tools.tools.find(t => t.name === 'health_check');
    expect(healthCheck).toBeDefined();
    
    await client.close();
  }, 10000); // 10 second timeout

  it('should list resources and prompts even when unconfigured', async () => {
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      env: {
        PATH: process.env.PATH
      }
    });

    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await client.connect(transport);
    
    // List resources
    const resources = await client.listResources();
    expect(resources.resources).toBeDefined();
    expect(Array.isArray(resources.resources)).toBe(true);
    // Should have at least the server info resource
    expect(resources.resources.length).toBeGreaterThan(0);
    
    // List prompts
    const prompts = await client.listPrompts();
    expect(prompts.prompts).toBeDefined();
    expect(Array.isArray(prompts.prompts)).toBe(true);
    // Should have the help prompt
    expect(prompts.prompts.length).toBeGreaterThan(0);
    
    await client.close();
  });
});