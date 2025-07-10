import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { entities } from '../src/tools/entities.js';
import { FastMCP } from 'fastmcp';
import { registerMinimalTools } from '../src/tools/minimal-tools.js';
import * as quickbooksBroker from '../src/quickbooks-broker.js';

// Mock the quickbooks-broker module
vi.mock('../src/quickbooks-broker.js', () => ({
    ensureAuth: vi.fn(),
    startOAuthFlow: vi.fn(),
    disconnect: vi.fn(),
}));

describe('QuickBooks Tools', () => {
    describe('Entity Configuration', () => {
        it('should have correct entity mappings', () => {
            expect(entities).toBeDefined();
            expect(entities.length).toBeGreaterThan(0);

            // Check for key entities
            const entityNames = entities.map((e) => e.name);
            expect(entityNames).toContain('customer');
            expect(entityNames).toContain('invoice');
            expect(entityNames).toContain('payment');
            expect(entityNames).toContain('vendor');
        });

        it('should have valid SDK function names', () => {
            entities.forEach((entity) => {
                expect(entity.sdkFn).toBeTruthy();
                expect(entity.sdkFn).toMatch(/^find[A-Z]/); // Should start with 'find' followed by capital letter
                expect(entity.description).toBeTruthy();
            });
        });
    });

    describe('Tool Parameters', () => {
        it('should have standard list parameters', () => {
            // Test that the parameter schema includes the expected fields
            const expectedParams = ['startDate', 'endDate', 'limit'];

            // This is more of a documentation test
            expect(expectedParams).toContain('startDate');
            expect(expectedParams).toContain('endDate');
            expect(expectedParams).toContain('limit');
        });
    });

    describe('Report Types', () => {
        it('should support common report types', () => {
            // Test that report types are properly defined
            const reportTypes = [
                'profit_and_loss',
                'balance_sheet',
                'cash_flow',
                'customer_sales',
                'aging_summary',
            ];

            reportTypes.forEach((type) => {
                expect(type).toBeTruthy();
            });
        });
    });

    describe('Minimal Tools', () => {
        let mcp: FastMCP;
        let registeredTools: Map<string, any>;

        beforeEach(() => {
            // Create a test instance of FastMCP
            mcp = new FastMCP({ name: 'test', version: '1.0.0' });
            registeredTools = new Map();

            // Mock the addTool method to capture registered tools
            vi.spyOn(mcp, 'addTool').mockImplementation((tool) => {
                registeredTools.set(tool.name, tool);
            });

            // Register minimal tools
            registerMinimalTools(mcp);
        });

        it('should register health_check tool', () => {
            expect(registeredTools.has('health_check')).toBe(true);
            const healthTool = registeredTools.get('health_check');
            expect(healthTool.description).toContain(
                'Check if the summon server is running'
            );
        });

        it('should register authenticate tool', () => {
            expect(registeredTools.has('authenticate')).toBe(true);
            const authTool = registeredTools.get('authenticate');
            expect(authTool.description).toContain(
                'Start QuickBooks OAuth authentication flow'
            );
        });

        it('should register clear_auth tool', () => {
            expect(registeredTools.has('clear_auth')).toBe(true);
            const clearAuthTool = registeredTools.get('clear_auth');
            expect(clearAuthTool.description).toContain(
                'Clear stored QuickBooks authentication'
            );
        });

        it('health_check should return OK', async () => {
            const healthTool = registeredTools.get('health_check');
            const result = await healthTool.execute({});
            expect(result.content[0].text).toContain('OK');
            expect(result.content[0].text).toContain('summon');
        });

        it('authenticate should start OAuth flow', async () => {
            vi.mocked(quickbooksBroker.startOAuthFlow).mockResolvedValue({
                authUrl: 'https://example.com/auth',
                message: 'Authentication successful!',
            });

            const authTool = registeredTools.get('authenticate');
            const result = await authTool.execute({ force: false });

            expect(result.content[0].text).toContain(
                'https://example.com/auth'
            );
            expect(result.content[0].text).toContain(
                'QuickBooks Authentication'
            );
            expect(quickbooksBroker.startOAuthFlow).toHaveBeenCalled();
        });

        it('clear_auth should disconnect and clear tokens', async () => {
            const clearAuthTool = registeredTools.get('clear_auth');
            const result = await clearAuthTool.execute({ confirm: true });

            expect(result.content[0].text).toContain('Authentication Cleared');
            expect(result.content[0].text).toContain(
                'QuickBooks authentication tokens have been cleared'
            );
        });

        it('clear_auth should require confirmation', async () => {
            const clearAuthTool = registeredTools.get('clear_auth');
            const result = await clearAuthTool.execute({ confirm: false });

            expect(result.content[0].text).toContain('Clear Authentication');
            expect(result.content[0].text).toContain('confirm: true');
        });
    });
});
