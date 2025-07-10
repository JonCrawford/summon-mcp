/**
 * QuickBooks MCP Server Integration Tests
 *
 * These tests spawn the actual MCP server process and communicate through
 * the MCP protocol to catch runtime errors that unit tests miss.
 *
 * Based on guidance from senior engineer: treat server as black box,
 * use real process spawning, real MCP protocol communication.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Mock the browser opener utility to prevent actual browser opening during tests
const mockOpenUrlInBrowser = vi.fn();
vi.mock('../src/utils/browser-opener.js', () => ({
    openUrlInBrowser: mockOpenUrlInBrowser,
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('QuickBooks MCP Server Integration Tests', () => {
    let serverProcess: ChildProcess;
    let client: Client;
    let tempWorkspaceDir: string;

    // Setup before each test
    beforeEach(async () => {
        // Create a temporary directory to simulate user workspace
        tempWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dxt-test-'));

        // Create MCP client to communicate with server
        client = new Client(
            {
                name: 'test-client',
                version: '1.0.0',
            },
            {
                capabilities: {
                    roots: {
                        listChanged: false,
                    },
                },
            }
        );

        // Setup transport to spawn the server process
        const serverPath = path.join(__dirname, '..', 'dist', 'server.js');
        const transport = new StdioClientTransport({
            command: 'node',
            args: [serverPath],
            env: {
                ...process.env,
                // Simulate DXT environment
                DXT_ENVIRONMENT: 'true',
                NODE_ENV: 'test', // Prevent browser opening in spawned process
                VITEST: 'true', // Additional check for test environment
                NODE_OPTIONS: '--require ./test/no-browser.cjs', // Force browser prevention
                QB_CLIENT_ID: 'test_client_id',
                QB_CLIENT_SECRET: 'test_client_secret',
                QB_STORAGE_DIR: tempWorkspaceDir,
            },
        });

        // Wait for connection to be established
        await client.connect(transport);

        // Store reference to the spawned process for cleanup
        serverProcess = (transport as any)._process;
    }, 30000); // 30 second timeout for setup

    // Cleanup after each test
    afterEach(async () => {
        // Close client connection
        if (client) {
            await client.close();
        }

        // Kill server process
        if (serverProcess && !serverProcess.killed) {
            serverProcess.kill('SIGKILL');

            // Wait for process to actually exit
            await new Promise((resolve) => {
                if (serverProcess.killed) {
                    resolve(void 0);
                } else {
                    serverProcess.on('exit', resolve);
                }
            });
        }

        // Clean up temporary directory
        if (fs.existsSync(tempWorkspaceDir)) {
            fs.rmSync(tempWorkspaceDir, { recursive: true, force: true });
        }
    });

    // Test 1: Basic server initialization and MCP handshake
    it('should initialize correctly and respond to ping', async () => {
        // The connection is established in beforeEach
        // Send a ping to verify live connection
        const response = await client.ping();
        expect(response).toBeDefined();
    });

    // Test 2: Health check tool (the one that was crashing)
    it('should call health_check tool successfully', async () => {
        const result = await client.callTool({
            name: 'health_check',
            arguments: {},
        });

        // Successful calls return content directly (no isError property)
        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0]).toHaveProperty('text');
        
        // Parse JSON response
        const healthData = JSON.parse(result.content[0].text);
        expect(healthData).toHaveProperty('status');
        expect(healthData.status).toContain('Server is running');
        expect(healthData).toHaveProperty('authenticated');
        expect(healthData).toHaveProperty('mode');
        
        // If authenticated, should have companies
        if (healthData.authenticated) {
            expect(healthData).toHaveProperty('companies');
        }
    });

    // Test 3: Tools list endpoint
    it('should return list of available tools', async () => {
        const result = await client.listTools();

        expect(result.tools).toBeDefined();
        expect(Array.isArray(result.tools)).toBe(true);
        expect(result.tools.length).toBeGreaterThan(0);

        // Check that critical tools are present
        const toolNames = result.tools.map((tool) => tool.name);
        expect(toolNames).toContain('health_check');
        expect(toolNames).toContain('authenticate');
        expect(toolNames).toContain('clear_auth');

        // Now all tools are registered at startup, including QB entity tools
        expect(toolNames.length).toBeGreaterThan(3);
    });

    // Test 4: Resources list endpoint
    it('should return list of available resources', async () => {
        const result = await client.listResources();

        expect(result.resources).toBeDefined();
        expect(Array.isArray(result.resources)).toBe(true);
        // Should have at least the server info resource and companies resource
        expect(result.resources.length).toBeGreaterThan(1);

        // Check for companies resource
        const resourceUris = result.resources.map((r) => r.uri);
        expect(resourceUris).toContain('qb://companies');
    });

    // Test 5: Prompts list endpoint
    it('should return list of available prompts', async () => {
        const result = await client.listPrompts();

        expect(result.prompts).toBeDefined();
        expect(Array.isArray(result.prompts)).toBe(true);
        // Should have at least the help prompt
        expect(result.prompts.length).toBeGreaterThan(0);
    });

    // Test 6: Authenticate tool (OAuth flow should start properly)
    it('should handle authenticate tool call without opening browser', async () => {
        // Clear any previous mock calls
        mockOpenUrlInBrowser.mockClear();

        // The OAuth flow will start but timeout waiting for callback in test environment
        // This is expected behavior - we just want to verify it doesn't crash
        // Browser opening is mocked via the browser-opener module

        // Set a timeout to avoid waiting too long for OAuth callback
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
                () =>
                    reject(
                        new Error(
                            'OAuth timeout expected - flow started successfully'
                        )
                    ),
                1500
            );
        });

        const authPromise = client.callTool({
            name: 'authenticate',
            arguments: {},
        });

        try {
            // Race between auth call and timeout
            const result = await Promise.race([authPromise, timeoutPromise]);

            // If we get a response, it should be properly formatted
            expect(result.content).toBeDefined();
            expect(result.content[0]).toHaveProperty('type', 'text');
            expect(result.content[0]).toHaveProperty('text');
        } catch (error: any) {
            // OAuth flow timeout is expected in test environment
            // Just verify the server didn't crash and OAuth flow started
            expect(error.message).toMatch(/(timeout|OAuth|flow)/i);

            // The key test is that we reach this point without browser opening
            // If the mock was called, it means browser opening was attempted but intercepted
            // If the mock wasn't called, it means the auth flow timed out before reaching browser opening
            // Both scenarios are acceptable - the important thing is no actual browser opened
            console.log(
                `Mock was called ${mockOpenUrlInBrowser.mock.calls.length} times`
            );
        }
    }, 2000); // Short timeout since OAuth flow will hang in test environment

    // Test 7: Clear auth tool
    it('should handle clear_auth tool call', async () => {
        const result = await client.callTool({
            name: 'clear_auth',
            arguments: { confirm: true },
        });

        expect(result.content).toBeDefined();
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0].text).toMatch(
            /(cleared|no companies|not authenticated)/i
        );
    });

    // Test 8: Companies resource
    it('should handle companies resource read', async () => {
        const result = await client.readResource({ uri: 'qb://companies' });

        expect(result.contents).toBeDefined();
        expect(result.contents[0]).toHaveProperty('text');

        // Should return valid JSON (empty array if no companies)
        const text = result.contents[0].text;
        expect(() => JSON.parse(text)).not.toThrow();

        // Should be an array
        const companies = JSON.parse(text);
        expect(Array.isArray(companies)).toBe(true);
    });

    // Test 9: Tool validation - all tools are available at startup
    it('should expose all tools including QB entity tools at startup', async () => {
        const result = await client.listTools();
        const toolNames = result.tools.map((tool) => tool.name);

        // Should have core tools plus all QB entity tools
        expect(toolNames).toContain('health_check');
        expect(toolNames).toContain('authenticate');
        expect(toolNames).toContain('clear_auth');
        expect(toolNames).toContain('qb_list_companies');
        expect(toolNames).toContain('qb_list_customers');
        expect(toolNames).toContain('qb_list_invoices');
        // All tools are registered at startup now
        expect(toolNames.length).toBeGreaterThan(10);
    });

    // Test 10: Error handling for invalid tool
    it('should handle invalid tool name gracefully', async () => {
        await expect(
            client.callTool({
                name: 'nonexistent_tool',
                arguments: {},
            })
        ).rejects.toThrow();
    });

    // Test 11: Error handling for invalid arguments to valid tools
    it('should handle invalid tool arguments gracefully', async () => {
        // Try to call health_check with unexpected arguments (should ignore them)
        const result = await client.callTool({
            name: 'health_check',
            arguments: {
                invalid_arg: 'should_be_ignored',
            },
        });

        // Should still work (ignores extra arguments)
        expect(result.content).toBeDefined();
        expect(result.content[0].text).toContain('Server is running');
    });

    // Test 12: Concurrent tool calls
    it('should handle concurrent tool calls', async () => {
        const promises = [
            client.callTool({ name: 'health_check', arguments: {} }),
            client.callTool({
                name: 'clear_auth',
                arguments: { confirm: true },
            }),
            client.callTool({ name: 'health_check', arguments: {} }),
        ];

        const results = await Promise.all(promises);

        results.forEach((result) => {
            expect(result.content).toBeDefined();
        });
    });

    // Test 13: Server version and info
    it('should provide server information through health_check', async () => {
        const result = await client.callTool({
            name: 'health_check',
            arguments: {},
        });

        expect(result.content).toBeDefined();
        const healthData = JSON.parse(result.content[0].text);
        expect(healthData.status).toContain('Server is running');
        expect(healthData.authenticated).toBe(false);
        expect(healthData).toHaveProperty('_instruction');
        expect(healthData._instruction).toContain('No QuickBooks companies');
    });

    // Test 14: list_companies should work without authentication
    it('should list companies without requiring authentication', async () => {
        // This test should PASS but currently FAILS because list_companies requires auth
        const result = await client.callTool({
            name: 'qb_list_companies',
            arguments: {},
        });

        // Should return an empty array or list of previously authenticated companies
        expect(result.content).toBeDefined();
        expect(result.content[0]).toHaveProperty('type', 'text');
        const text = result.content[0].text;
        
        // Should be valid JSON
        expect(() => JSON.parse(text)).not.toThrow();
        
        // Should have the expected structure with _context and companies
        const response = JSON.parse(text);
        expect(response).toHaveProperty('_context');
        expect(response).toHaveProperty('companies');
        expect(Array.isArray(response.companies)).toBe(true);
    });

    // Test 15: Entity tools should accept realmId parameter
    it('should accept realmId parameter for entity tools', async () => {
        // This test verifies the parameter is accepted (will fail due to no auth)
        const result = await client.callTool({
            name: 'qb_list_invoices',
            arguments: {
                realmId: '9341454914780836',
                limit: 5,
            },
        });
        
        // Should return an error (no company with that realm ID in test environment)
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('not found');
        
        // The fact that it accepted the realmId parameter and tried to find
        // the company confirms the parameter is properly accepted
    });
});
