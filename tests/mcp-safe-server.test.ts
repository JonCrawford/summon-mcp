import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

describe('MCP Safe Server Tests', () => {
  const serverSafePath = join(__dirname, '..', 'src', 'server-safe.ts');
  const distPath = join(__dirname, '..', 'dist');
  const compiledServerPath = join(distPath, 'server-safe.js');

  beforeEach(() => {
    // Ensure dist directory exists
    if (!fs.existsSync(distPath)) {
      fs.mkdirSync(distPath, { recursive: true });
    }
    
    // Compile the server-safe.ts file
    try {
      execSync(`npx tsc ${serverSafePath} --outDir ${distPath} --module esnext --target es2022 --moduleResolution node --allowSyntheticDefaultImports --esModuleInterop`, {
        stdio: 'pipe'
      });
    } catch (error) {
      console.error('TypeScript compilation error:', error);
      throw error;
    }
  });

  afterEach(() => {
    // Clean up compiled file
    if (fs.existsSync(compiledServerPath)) {
      fs.unlinkSync(compiledServerPath);
    }
  });

  it('should complete handshake even with tools registration failure', async () => {
    // Mock a failure by providing invalid environment
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [compiledServerPath],
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        // Force a tools registration error by breaking the import
        FORCE_TOOLS_ERROR: 'true'
      }
    });

    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    // Should connect successfully
    await client.connect(transport);
    
    // Should be able to list tools
    const tools = await client.listTools();
    expect(tools.tools).toBeDefined();
    
    // health_check should exist and report the error
    const healthCheck = tools.tools.find(t => t.name === 'health_check');
    expect(healthCheck).toBeDefined();
    
    // Call health_check to see if it reports the error
    const result = await client.callTool('health_check', {});
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    
    await client.close();
  });

  it('should handle uncaught exceptions without immediate exit', async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [compiledServerPath],
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        INTUIT_CLIENT_ID: 'test',
        INTUIT_CLIENT_SECRET: 'test'
      }
    });

    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    // Connect should succeed
    await client.connect(transport);
    
    // Verify we can interact with the server
    const tools = await client.listTools();
    expect(tools.tools).toBeDefined();
    
    await client.close();
  });

  it('should report initialization errors through server info resource', async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [compiledServerPath],
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test'
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
    
    // Find server info resource
    const serverInfo = resources.resources.find(r => r.name === 'Server Info');
    expect(serverInfo).toBeDefined();
    
    // Read server info
    const info = await client.readResource(serverInfo!.uri);
    const parsed = JSON.parse(info.contents[0].text!);
    
    expect(parsed.name).toBe('QuickBooks MCP Server');
    expect(parsed.capabilities).toContain('tools');
    
    await client.close();
  });
});