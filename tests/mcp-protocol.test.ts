import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

describe.skip('MCP Protocol Initialization', () => {
  // Skipping because this test manually constructs JSON-RPC messages which don't match
  // FastMCP's expected format. The same functionality is tested correctly using the 
  // official MCP SDK in tests/mcp-handshake-compliance.test.ts
  let serverProcess: ChildProcess;
  let initializeResponse: any;
  let initialized = false;

  /**
   * Helper to send JSON-RPC messages to the server via stdio
   */
  const sendMessage = (message: any) => {
    const json = JSON.stringify(message);
    const content = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
    serverProcess.stdin!.write(content);
  };

  /**
   * Helper to parse JSON-RPC messages from stdio
   */
  const parseMessages = (data: Buffer): any[] => {
    const messages: any[] = [];
    const text = data.toString();
    
    // Split by double CRLF to find message boundaries
    const parts = text.split('\r\n\r\n');
    
    for (let i = 0; i < parts.length - 1; i++) {
      const header = parts[i];
      const contentLengthMatch = header.match(/Content-Length: (\d+)/);
      
      if (contentLengthMatch) {
        const contentLength = parseInt(contentLengthMatch[1], 10);
        const content = parts[i + 1];
        
        if (content && content.length >= contentLength) {
          try {
            const json = JSON.parse(content.substring(0, contentLength));
            messages.push(json);
          } catch (e) {
            console.error('Failed to parse JSON:', content.substring(0, contentLength));
          }
        }
      }
    }
    
    return messages;
  };

  beforeAll(async () => {
    // Start the server process
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Ensure we're in test mode
        NODE_ENV: 'test',
        // Provide minimal config to prevent early exits
        QB_CLIENT_ID: 'test-client-id',
        QB_CLIENT_SECRET: 'test-client-secret'
      }
    });

    // Collect stdout data
    const stdoutData: Buffer[] = [];
    serverProcess.stdout!.on('data', (data: Buffer) => {
      stdoutData.push(data);
      
      // Try to parse messages
      const fullData = Buffer.concat(stdoutData);
      const messages = parseMessages(fullData);
      
      for (const msg of messages) {
        if (msg.id === 1 && msg.result) {
          initializeResponse = msg;
          initialized = true;
        }
      }
    });

    // Log stderr for debugging
    serverProcess.stderr!.on('data', (data: Buffer) => {
      console.error('Server stderr:', data.toString());
    });

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send initialize request
    sendMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'mcp-test-client',
          version: '1.0.0'
        }
      }
    });

    // Wait for initialization response
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for initialization response'));
      }, 5000);

      const checkInterval = setInterval(() => {
        if (initialized) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should complete MCP handshake successfully', () => {
    expect(initialized).toBe(true);
    expect(initializeResponse).toBeDefined();
    expect(initializeResponse.result).toBeDefined();
  });

  it('should return valid server info in initialize response', () => {
    expect(initializeResponse.result.serverInfo).toBeDefined();
    expect(initializeResponse.result.serverInfo.name).toBe('quickbooks-mcp');
    expect(initializeResponse.result.serverInfo.version).toBeDefined();
  });

  it('should return MCP protocol version', () => {
    expect(initializeResponse.result.protocolVersion).toBe('2024-11-05');
  });

  it('should return available capabilities', () => {
    expect(initializeResponse.result.capabilities).toBeDefined();
    expect(initializeResponse.result.capabilities.tools).toBeDefined();
  });

  it('should be able to call tools/list after initialization', async () => {
    const toolsListResponse = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for tools/list response'));
      }, 5000);

      let responseReceived = false;
      const tempHandler = (data: Buffer) => {
        const messages = parseMessages(data);
        for (const msg of messages) {
          if (msg.id === 2 && msg.result) {
            responseReceived = true;
            clearTimeout(timeout);
            serverProcess.stdout!.removeListener('data', tempHandler);
            resolve(msg);
          }
        }
      };

      serverProcess.stdout!.on('data', tempHandler);

      // Send tools/list request
      sendMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      });
    });

    expect(toolsListResponse.result).toBeDefined();
    expect(toolsListResponse.result.tools).toBeInstanceOf(Array);
    expect(toolsListResponse.result.tools.length).toBeGreaterThan(0);
    
    // Verify we have the health_check tool
    const healthCheckTool = toolsListResponse.result.tools.find((t: any) => t.name === 'health_check');
    expect(healthCheckTool).toBeDefined();
  });
});

describe('MCP Protocol Error Handling', () => {
  it('should handle initialization with missing required fields gracefully', async () => {
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    const serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        QB_CLIENT_ID: 'test-client-id',
        QB_CLIENT_SECRET: 'test-client-secret'
      }
    });

    let errorResponse: any;

    serverProcess.stdout!.on('data', (data: Buffer) => {
      const messages = parseMessages(data);
      for (const msg of messages) {
        if (msg.error) {
          errorResponse = msg;
        }
      }
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send invalid initialize request (missing protocolVersion)
    const sendMessage = (message: any) => {
      const json = JSON.stringify(message);
      const content = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
      serverProcess.stdin!.write(content);
    };

    sendMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        // Missing protocolVersion
        capabilities: {},
        clientInfo: {
          name: 'mcp-test-client',
          version: '1.0.0'
        }
      }
    });

    // Wait for error response
    await new Promise(resolve => setTimeout(resolve, 2000));

    serverProcess.kill();

    // The server should either handle the error gracefully or FastMCP should handle it
    // The key is that the server should not exit before responding
    expect(serverProcess.exitCode).toBeNull(); // Process was killed by us, not exited early
  });
});

/**
 * Helper to parse JSON-RPC messages from stdio (exported for reuse)
 */
function parseMessages(data: Buffer): any[] {
  const messages: any[] = [];
  const text = data.toString();
  
  // Split by double CRLF to find message boundaries
  const parts = text.split('\r\n\r\n');
  
  for (let i = 0; i < parts.length - 1; i++) {
    const header = parts[i];
    const contentLengthMatch = header.match(/Content-Length: (\d+)/);
    
    if (contentLengthMatch) {
      const contentLength = parseInt(contentLengthMatch[1], 10);
      const content = parts[i + 1];
      
      if (content && content.length >= contentLength) {
        try {
          const json = JSON.parse(content.substring(0, contentLength));
          messages.push(json);
        } catch (e) {
          console.error('Failed to parse JSON:', content.substring(0, contentLength));
        }
      }
    }
  }
  
  return messages;
}