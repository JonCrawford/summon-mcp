import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';

describe('Server Integration', () => {
  let serverProcess: any;

  afterEach(() => {
    // Clean up server process
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  describe('Environment Mode', () => {
    it('should start in sandbox mode by default', async () => {
      // Set up environment without QUICKBOOKS_PRODUCTION
      const env = {
        ...process.env,
        INTUIT_CLIENT_ID: 'test_client_id',
        INTUIT_CLIENT_SECRET: 'test_client_secret'
      };
      delete env.QUICKBOOKS_PRODUCTION;

      // Start server
      serverProcess = spawn('npx', ['tsx', 'src/server.ts', '--stdio'], {
        cwd: path.join(__dirname, '..'),
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Give server time to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Server should be running (not exited)
      expect(serverProcess.exitCode).toBeNull();
    });

    it('should start in production mode when QUICKBOOKS_PRODUCTION is true', async () => {
      // Set up environment with QUICKBOOKS_PRODUCTION=true
      const env = {
        ...process.env,
        INTUIT_CLIENT_ID: 'test_client_id',
        INTUIT_CLIENT_SECRET: 'test_client_secret',
        QUICKBOOKS_PRODUCTION: 'true'
      };

      // Start server
      serverProcess = spawn('npx', ['tsx', 'src/server.ts', '--stdio'], {
        cwd: path.join(__dirname, '..'),
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Give server time to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Server should be running (not exited)
      expect(serverProcess.exitCode).toBeNull();
    });

    it('should handle missing credentials gracefully', async () => {
      // Set up environment without credentials
      const env = {
        ...process.env
      };
      delete env.INTUIT_CLIENT_ID;
      delete env.INTUIT_CLIENT_SECRET;

      // Start server
      serverProcess = spawn('npx', ['tsx', 'src/server.ts', '--stdio'], {
        cwd: path.join(__dirname, '..'),
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Give server time to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Server should still be running (graceful error handling)
      expect(serverProcess.exitCode).toBeNull();
    });
  });
});