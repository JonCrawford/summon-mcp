import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';

describe('Server Broker Integration', () => {
  let serverProcess: any;

  afterEach(() => {
    // Clean up server process
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  describe('Broker Mode', () => {
    it('should start successfully with valid broker configuration', async () => {
      // Set up environment with broker config
      const env = {
        ...process.env,
        brokerApiUrl: 'https://broker.example.com',
        brokerApiToken: 'test-token',
        defaultCompany: 'Test Company',
        cacheTTL: '24'
      };

      // Start server
      serverProcess = spawn('npx', ['tsx', 'src/server-broker.ts'], {
        cwd: path.join(__dirname, '..'),
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Give server time to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Server should be running (not exited)
      expect(serverProcess.exitCode).toBeNull();
    });

    it('should exit with error when broker config is missing', async () => {
      // Set up environment without broker config
      const env = {
        ...process.env
      };
      delete env.brokerApiUrl;
      delete env.brokerApiToken;

      // Start server
      serverProcess = spawn('npx', ['tsx', 'src/server-broker.ts'], {
        cwd: path.join(__dirname, '..'),
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Wait for the process to exit
      await new Promise((resolve) => {
        serverProcess.on('exit', (code: number) => {
          resolve(code);
        });
        
        // Timeout after 2 seconds
        setTimeout(() => resolve(null), 2000);
      });

      // Server should have exited with error
      expect(serverProcess.exitCode).toBe(1);
    });

    it('should handle debug logging configuration', async () => {
      // Set up environment with debug enabled
      const env = {
        ...process.env,
        brokerApiUrl: 'https://broker.example.com',
        brokerApiToken: 'test-token',
        enableDebugLogging: 'true'
      };

      // Start server
      serverProcess = spawn('npx', ['tsx', 'src/server-broker.ts'], {
        cwd: path.join(__dirname, '..'),
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Collect stderr output
      let stderrData = '';
      const stderrPromise = new Promise<void>((resolve) => {
        serverProcess.stderr.on('data', (data: Buffer) => {
          stderrData += data.toString();
          // Resolve once we see debug output
          if (stderrData.includes('[QuickBooks MCP]')) {
            resolve();
          }
        });
      });

      // Wait for debug output or timeout
      await Promise.race([
        stderrPromise,
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);

      // Should have debug output
      expect(stderrData).toContain('[QuickBooks MCP]');
      expect(serverProcess.exitCode).toBeNull();
    });
  });
});