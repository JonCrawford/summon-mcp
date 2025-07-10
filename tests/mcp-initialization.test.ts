import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';

describe('MCP Server Initialization Compliance', () => {
    it('should not exit when INTUIT credentials are missing', async () => {
        const serverPath = join(__dirname, '..', 'dist', 'server.js');

        // Start server without required credentials
        const serverProcess = spawn('node', [serverPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                // Intentionally missing QB_CLIENT_ID and QB_CLIENT_SECRET
            },
        });

        let serverExited = false;
        let exitCode: number | null = null;

        serverProcess.on('exit', (code) => {
            serverExited = true;
            exitCode = code;
        });

        // Collect stderr output
        let stderrOutput = '';
        serverProcess.stderr!.on('data', (data: Buffer) => {
            stderrOutput += data.toString();
        });

        // Wait 2 seconds to see if server exits
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Server should still be running
        expect(serverExited).toBe(false);
        expect(exitCode).toBeNull();

        // Clean up
        serverProcess.kill();
    });

    it('should not exit when tools registration has issues', async () => {
        const serverPath = join(__dirname, '..', 'dist', 'server.js');

        // Start server with minimal config
        const serverProcess = spawn('node', [serverPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                QB_CLIENT_ID: 'test',
                QB_CLIENT_SECRET: 'test',
            },
        });

        let serverExited = false;
        let exitCode: number | null = null;

        serverProcess.on('exit', (code) => {
            serverExited = true;
            exitCode = code;
        });

        // Wait 2 seconds
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Server should still be running even if tools have issues
        expect(serverExited).toBe(false);
        expect(exitCode).toBeNull();

        // Clean up
        serverProcess.kill();
    });

    it('should start successfully and log to stderr', async () => {
        const serverPath = join(__dirname, '..', 'dist', 'server.js');

        const serverProcess = spawn('node', [serverPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                QB_CLIENT_ID: 'test',
                QB_CLIENT_SECRET: 'test',
            },
        });

        let stderrOutput = '';
        serverProcess.stderr!.on('data', (data: Buffer) => {
            stderrOutput += data.toString();
        });

        // Wait for server to start (FastMCP takes a bit longer)
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Check for expected startup messages
        expect(stderrOutput).toContain('summon server started successfully');
        expect(stderrOutput).not.toContain('Failed to start MCP server');

        // Clean up
        serverProcess.kill();
    });
});
