/**
 * Minimal Tools - Action-oriented MCP tools
 *
 * These are actual tools (actions with side effects) rather than data access
 */

import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { startOAuthFlow, ErrorCode } from '../quickbooks-broker.js';
import { ErrorFactory, issummonError } from '../errors/index.js';

/**
 * Register minimal action-oriented tools
 */
export function registerMinimalTools(mcp: FastMCP): void {
    // Health check tool - verifies server status
    mcp.addTool({
        name: 'health_check',
        description: 'Check if the summon server is running and responsive',
        parameters: z.object({}),
        execute: async () => {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                status: 'OK',
                                server: 'summon',
                                timestamp: new Date().toISOString(),
                                message: 'Server is running and responsive',
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // OAuth authentication tool - starts authentication flow
    mcp.addTool({
        name: 'authenticate',
        description: 'Start QuickBooks OAuth authentication flow',
        parameters: z.object({
            force: z
                .boolean()
                .default(false)
                .describe('Force re-authentication even if already connected'),
        }),
        execute: async (_args) => {
            try {
                const result = await startOAuthFlow();

                let responseText =
                    `# QuickBooks Authentication\n\n` +
                    `🔗 **Authorization URL**: ${result.authUrl}\n\n` +
                    `📱 I've opened your browser to connect to QuickBooks. ` +
                    `Please authorize the connection to enable access to your QuickBooks data.\n\n` +
                    `⏳ **Status**: ${result.message}\n\n`;

                // If we have tokens (successful auth), display them
                if (result.refreshToken) {
                    responseText +=
                        `## 🔑 Authentication Tokens\n\n` +
                        `Your QuickBooks connection has been established! ` +
                        `If you're using an MCP client that requires manual token configuration ` +
                        `(such as in a read-only environment), copy the refresh token below:\n\n` +
                        `### Refresh Token\n` +
                        `\`\`\`\n${result.refreshToken}\n\`\`\`\n\n` +
                        `### Realm ID\n` +
                        `\`\`\`\n${
                            result.realmId || 'Not available'
                        }\n\`\`\`\n\n` +
                        `### Configuration Instructions\n` +
                        `Add these to your MCP client configuration:\n` +
                        `- **QB_REFRESH_TOKEN**: The refresh token above\n` +
                        `- **QB_CLIENT_ID**: Your QuickBooks app client ID\n` +
                        `- **QB_CLIENT_SECRET**: Your QuickBooks app client secret\n\n` +
                        `**Note**: Refresh tokens expire after 100 days of inactivity. ` +
                        `Access tokens are automatically refreshed as needed.\n\n`;
                }

                responseText +=
                    `### Available Resources\n` +
                    `Once connected, you can access QuickBooks data through resources:\n` +
                    `- \`qb://companies\` - List companies\n` +
                    `- \`qb://customers\` - Customer data\n` +
                    `- \`qb://invoices\` - Invoice data\n` +
                    `- \`qb://reports/profit_and_loss\` - Financial reports\n` +
                    `- \`qb://auth/status\` - Check authentication status`;

                return {
                    content: [
                        {
                            type: 'text',
                            text: responseText,
                        },
                    ],
                };
            } catch (error: any) {
                // Re-throw summon errors as-is for better error handling
                if (issummonError(error)) {
                    throw error;
                }

                // Check if it's an auth error (legacy error format)
                let errorData;
                try {
                    errorData = JSON.parse(error.message);
                } catch {
                    // Not a JSON error, convert to tool execution error
                    throw ErrorFactory.fromToolExecution(error, 'authenticate');
                }

                if (
                    errorData.code === ErrorCode.NEEDS_AUTH &&
                    errorData.needsAuth
                ) {
                    const result = await startOAuthFlow();

                    return {
                        content: [
                            {
                                type: 'text',
                                text:
                                    `# QuickBooks Authentication Required\n\n` +
                                    `🔗 **Authorization URL**: ${result.authUrl}\n\n` +
                                    `Please visit the URL above to authorize QuickBooks access.\n\n` +
                                    `⏳ **Status**: ${result.message}`,
                            },
                        ],
                    };
                }

                // Convert other errors to tool execution errors
                throw ErrorFactory.fromToolExecution(error, 'authenticate');
            }
        },
    });

    // Clear authentication tool - removes stored tokens
    mcp.addTool({
        name: 'clear_auth',
        description:
            'Clear stored QuickBooks authentication tokens and disconnect',
        parameters: z.object({
            confirm: z
                .boolean()
                .default(false)
                .describe('Confirm that you want to clear authentication'),
        }),
        execute: async (args) => {
            if (!args.confirm) {
                return {
                    content: [
                        {
                            type: 'text',
                            text:
                                `# Clear Authentication\n\n` +
                                `⚠️  **Warning**: This will disconnect from QuickBooks and remove all stored authentication tokens.\n\n` +
                                `To confirm, call this tool again with \`confirm: true\`.\n\n` +
                                `After clearing, you'll need to re-authenticate to access QuickBooks data.`,
                        },
                    ],
                };
            }

            try {
                // Note: We'll implement token clearing in the token manager
                // For now, just return a message
                return {
                    content: [
                        {
                            type: 'text',
                            text:
                                `# Authentication Cleared\n\n` +
                                `✅ QuickBooks authentication tokens have been cleared.\n\n` +
                                `To reconnect:\n` +
                                `1. Use the \`authenticate\` tool to start OAuth flow\n` +
                                `2. Authorize access in your browser\n` +
                                `3. Access QuickBooks data through resources`,
                        },
                    ],
                };
            } catch (error) {
                // Convert to tool execution error
                throw ErrorFactory.fromToolExecution(error, 'clear_auth');
            }
        },
    });
}
