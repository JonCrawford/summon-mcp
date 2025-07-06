#!/usr/bin/env node

// Simple test to verify MCP protocol handling
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.error('Test MCP server started - waiting for messages...');

rl.on('line', (line) => {
  console.error('Received message:', line);
  
  try {
    const message = JSON.parse(line);
    console.error('Parsed message:', JSON.stringify(message, null, 2));
    
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
            name: 'quickbooks-mcp-test',
            version: '1.0.0'
          }
        }
      };
      
      console.error('Sending response:', JSON.stringify(response, null, 2));
      console.log(JSON.stringify(response));
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

rl.on('close', () => {
  console.error('stdin closed, exiting...');
  process.exit(0);
});

// Keep process alive
process.stdin.resume();