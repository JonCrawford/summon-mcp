#!/usr/bin/env node
import readline from 'readline';

console.error('Minimal MCP server starting...');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  console.error('Received:', line);
  
  try {
    const message = JSON.parse(line);
    
    if (message.method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'quickbooks-mcp-minimal',
            version: '1.0.0'
          }
        }
      };
      
      console.log(JSON.stringify(response));
      console.error('Sent initialize response');
    } else if (message.method === 'tools/list') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: [{
            name: 'health_check',
            description: 'Check if the server is running',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }]
        }
      };
      
      console.log(JSON.stringify(response));
      console.error('Sent tools/list response');
    } else if (message.method === 'tools/call') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [{
            type: 'text',
            text: 'OK from minimal server'
          }]
        }
      };
      
      console.log(JSON.stringify(response));
      console.error('Sent tools/call response');
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

// Keep alive
process.stdin.resume();

// Handle close
rl.on('close', () => {
  console.error('stdin closed');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('SIGTERM received');
  process.exit(0);
});