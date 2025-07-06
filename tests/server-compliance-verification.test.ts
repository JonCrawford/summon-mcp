import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';

describe('Server Compliance Verification', () => {
  // Test the existing server to verify it's already compliant
  it('current server does not exit on missing credentials', async () => {
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    
    const serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        // No credentials
      }
    });

    let exitCode: number | null = null;
    let exited = false;

    serverProcess.on('exit', (code) => {
      exitCode = code;
      exited = true;
    });

    // Wait 3 seconds - server should not exit
    await new Promise(resolve => setTimeout(resolve, 3000));

    expect(exited).toBe(false);
    expect(exitCode).toBeNull();

    // Clean up
    serverProcess.kill();
  });

  it('current server logs errors but continues running', async () => {
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    
    const serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        // Partial config
        INTUIT_CLIENT_ID: 'test-id'
      }
    });

    let stderrOutput = '';
    serverProcess.stderr!.on('data', (data: Buffer) => {
      stderrOutput += data.toString();
    });

    // Wait for startup
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Should see startup message
    expect(stderrOutput).toContain('MCP server started successfully');
    
    // Should still be running
    expect(serverProcess.killed).toBe(false);

    // Clean up
    serverProcess.kill();
  });

  it('verifies no early process.exit calls affect handshake', async () => {
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    
    // Start multiple instances with different configs to stress test
    const configs = [
      {}, // No env
      { NODE_ENV: 'test' }, // Minimal env
      { INTUIT_CLIENT_ID: 'bad', INTUIT_CLIENT_SECRET: 'bad' }, // Bad credentials
    ];

    const processes = configs.map(env => {
      return spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          PATH: process.env.PATH,
          ...env
        }
      });
    });

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    // All should still be running
    processes.forEach((proc, index) => {
      expect(proc.killed).toBe(false);
      expect(proc.exitCode).toBeNull();
    });

    // Clean up
    processes.forEach(proc => proc.kill());
  });
});