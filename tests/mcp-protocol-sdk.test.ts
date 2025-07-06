import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('MCP Protocol SDK Test', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // Start the server process
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        INTUIT_CLIENT_ID: 'test-client-id',
        INTUIT_CLIENT_SECRET: 'test-client-secret'
      }
    });

    // Log stderr for debugging
    serverProcess.stderr!.on('data', (data: Buffer) => {
      console.error('Server stderr:', data.toString());
    });

    // Create client with stdio transport
    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        INTUIT_CLIENT_ID: 'test-client-id',
        INTUIT_CLIENT_SECRET: 'test-client-secret'
      }
    });

    client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    // Connect client
    await client.connect(transport);
  }, 10000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
  });

  it('should complete MCP handshake successfully', () => {
    expect(client).toBeDefined();
    // If we got here, the handshake was successful
  });

  it('should list available tools', async () => {
    const result = await client.listTools();
    expect(result.tools).toBeDefined();
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools.length).toBeGreaterThan(0);
    
    // Check for health_check tool
    const healthCheck = result.tools.find(t => t.name === 'health_check');
    expect(healthCheck).toBeDefined();
  });

  it('should call health_check tool', async () => {
    const result = await client.callTool('health_check', {});
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('OK');
  });
});

describe('MCP Protocol Compliance', () => {
  it('should handle missing environment variables gracefully', async () => {
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    
    // Start server without required env vars
    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: {
        NODE_ENV: 'test'
        // Missing INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET
      }
    });

    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    // Should still be able to connect
    await expect(client.connect(transport)).resolves.not.toThrow();
    
    // Should be able to list tools
    const result = await client.listTools();
    expect(result.tools).toBeDefined();
    
    await client.close();
  });
});