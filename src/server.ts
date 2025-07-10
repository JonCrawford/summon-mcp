/**
 * Unified summon Server Entry Point
 *
 * This is the single server implementation that can run in any environment:
 * - Local development with direct OAuth client
 * - DXT environment with broker pattern
 * - Production deployment
 *
 * Environment detection is automatic based on configuration and environment variables.
 */

import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { TokenManager } from './token-manager.js';
import { QuickBooksBroker } from './quickbooks-broker-mt.js';
import { registerQuickBooksTools } from './tools/index.js';
import { registerQuickBooksResources } from './resources/index.js';
import { registerQuickBooksPrompts } from './prompts/index.js';
import { logger } from './logger.js';

// Server deployment modes
export enum ServerMode {
    DEVELOPMENT = 'development', // Local development with full OAuth client
    DXT = 'dxt', // DXT environment with broker pattern
    PRODUCTION = 'production', // Production deployment
}

// Server configuration interface
interface ServerConfig {
    mode: ServerMode;
    enableFileLogging: boolean;
    enableResourcesAndPrompts: boolean;
    version: string;
}

// Detect server deployment mode
function detectServerMode(): ServerMode {
    // DXT environment detection
    if (process.env.DXT_ENVIRONMENT === 'true') {
        return ServerMode.DXT;
    }

    // Production environment detection
    if (process.env.NODE_ENV === 'production') {
        return ServerMode.PRODUCTION;
    }

    // Default to development mode
    return ServerMode.DEVELOPMENT;
}

// Get server configuration based on mode
function getServerConfig(mode: ServerMode): ServerConfig {
    switch (mode) {
        case ServerMode.DXT:
            return {
                mode,
                enableFileLogging: false, // No file writes in DXT
                enableResourcesAndPrompts: true,
                version: '2.0.17',
            };

        case ServerMode.PRODUCTION:
            return {
                mode,
                enableFileLogging: true, // Enable logging in production
                enableResourcesAndPrompts: true,
                version: '2.0.17',
            };

        case ServerMode.DEVELOPMENT:
        default:
            return {
                mode,
                enableFileLogging: true, // Enable logging for debugging
                enableResourcesAndPrompts: true,
                version: '1.0.0',
            };
    }
}

// Initialize server based on configuration
async function initializeServer(): Promise<void> {
    const mode = detectServerMode();
    const config = getServerConfig(mode);

    // Configure logging based on mode
    if (!config.enableFileLogging) {
        process.env.QUICKBOOKS_NO_FILE_LOGGING = 'true';
    }

    logger.info(`summon Server starting in ${mode} mode...`);
    logger.info(`Node version: ${process.version}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Initialize FastMCP server
    const mcp = new FastMCP({
        name: 'summon',
        version: config.version as `${number}.${number}.${number}`,
    });

    // Track initialization state
    let initializationError: Error | null = null;
    let tokenManager: TokenManager | null = null;
    let qbBroker: QuickBooksBroker | null = null;
    let toolsRegistered = false;
    let hasCredentials = false;

    // Initialize core components immediately for tool registration
    try {
        tokenManager = new TokenManager();
        qbBroker = new QuickBooksBroker(tokenManager);

        // Register QuickBooks tools immediately so they're available in the manifest
        registerQuickBooksTools(mcp, qbBroker);
        toolsRegistered = true;
        logger.info('QuickBooks tools registered at startup');
    } catch (error) {
        logger.error(
            'Failed to initialize QuickBooks components at startup',
            error
        );
        initializationError = error as Error;
    }

    // Lazy initialization function
    async function initializeComponents(): Promise<void> {
        if (tokenManager && qbBroker && toolsRegistered) {
            return; // Already initialized
        }

        try {
            // Check credentials using environment variables directly
            const clientId = process.env.QB_CLIENT_ID;
            const clientSecret = process.env.QB_CLIENT_SECRET;
            hasCredentials = !!(clientId && clientSecret);

            if (!tokenManager) {
                tokenManager = new TokenManager();
            }

            if (!qbBroker) {
                qbBroker = new QuickBooksBroker(tokenManager);
            }

            // Tools are already registered at startup

            logger.info('QuickBooks components initialized successfully');
        } catch (error) {
            initializationError = error as Error;
            logger.error('Failed to initialize QuickBooks components', error);
            throw error;
        }
    }

    // Add core tools (always available)
    mcp.addTool({
        name: 'health_check',
        description: 'Check if the summon server is running and responsive, including connected companies',
        parameters: z.object({}),
        execute: async () => {
            try {
                await initializeComponents();
            } catch (error) {
                // Component initialization failed, but we can still report basic status
            }

            const hasToken = tokenManager
                ? await tokenManager.hasRefreshToken()
                : false;

            let status = `Server is running in ${mode} mode`;
            const details: string[] = [];
            let companies: { name: string; realmId: string }[] = [];
            let instruction = '';

            if (initializationError) {
                status = `Server running with initialization errors (${mode} mode)`;
                details.push(
                    `Initialization error: ${initializationError.message}`
                );
            }

            if (!hasCredentials) {
                details.push('OAuth credentials not configured');
            }

            if (!hasToken) {
                details.push('Not authenticated with QuickBooks');
                instruction = 'No QuickBooks companies are currently connected. Use the authenticate tool to connect to QuickBooks.';
            } else {
                details.push('Authenticated with QuickBooks');
                
                // Get company list when authenticated
                if (qbBroker) {
                    try {
                        companies = await qbBroker.listCompanies();
                        
                        if (companies.length === 0) {
                            instruction = 'Authenticated but no companies found. This may indicate a connection issue.';
                        } else if (companies.length === 1) {
                            instruction = `Currently connected to one QuickBooks company: "${companies[0].name}" (Realm ID: ${companies[0].realmId}). When performing operations, always mention this company name.`;
                        } else {
                            instruction = `Connected to ${companies.length} QuickBooks companies. When performing operations, always specify which company you're working with: ${companies.map(c => `"${c.name}" (Realm ID: ${c.realmId})`).join(', ')}.`;
                        }
                    } catch (error) {
                        console.error('Failed to list companies in health_check:', error);
                        instruction = 'Authenticated but failed to retrieve company list.';
                    }
                }
            }

            // Build response with all information
            const response: any = {
                status,
                mode,
                authenticated: hasToken,
                credentials_configured: hasCredentials,
            };

            if (hasToken && companies.length > 0) {
                response.companies = companies;
            }

            if (instruction) {
                response._instruction = instruction;
            }

            if (details.length > 0) {
                response.details = details;
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(response, null, 2),
                    },
                ],
            };
        },
    });

    mcp.addTool({
        name: 'authenticate',
        description: 'Start QuickBooks OAuth authentication flow',
        parameters: z.object({
            force: z
                .boolean()
                .optional()
                .describe('Force re-authentication even if already connected'),
        }),
        execute: async (args) => {
            await initializeComponents();

            if (!qbBroker) {
                throw new Error('QuickBooks broker not initialized');
            }

            const result = await qbBroker.authenticate(args.force);
            return {
                content: [
                    {
                        type: 'text',
                        text: result,
                    },
                ],
            };
        },
    });

    mcp.addTool({
        name: 'clear_auth',
        description:
            'Clear stored QuickBooks authentication tokens and disconnect',
        parameters: z.object({
            confirm: z
                .boolean()
                .optional()
                .describe('Confirm that you want to clear authentication'),
        }),
        execute: async (args) => {
            if (!args.confirm) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Please confirm you want to clear authentication by setting confirm: true',
                        },
                    ],
                };
            }

            await initializeComponents();

            if (!tokenManager) {
                throw new Error('Token manager not initialized');
            }

            await tokenManager.clearTokens();
            return {
                content: [
                    {
                        type: 'text',
                        text: 'QuickBooks authentication cleared successfully',
                    },
                ],
            };
        },
    });

    // Add server info resource (always available for MCP compliance)
    mcp.addResource({
        name: 'Server Info',
        description: `Information about the summon server (${mode} mode)`,
        uri: 'quickbooks://server-info',
        mimeType: 'application/json',
        load: async () => {
            try {
                await initializeComponents();
            } catch (error) {
                // Resource can still load even if components failed to initialize
            }

            return {
                text: JSON.stringify(
                    {
                        name: 'summon Server',
                        version: config.version,
                        mode: mode,
                        description: `MCP server for QuickBooks Online integration (${mode} mode)`,
                        capabilities: ['tools', 'resources', 'prompts'],
                        status: {
                            initialized: !initializationError,
                            hasCredentials: hasCredentials,
                            initializationError:
                                initializationError?.message || null,
                        },
                    },
                    null,
                    2
                ),
            };
        },
    });

    // Add help prompt (always available for MCP compliance)
    mcp.addPrompt({
        name: 'quickbooks-help',
        description: 'Get help with summon tools and features',
        arguments: [],
        load: async () => `
summon Server Help (${mode} mode)

This server provides integration with QuickBooks Online through the MCP protocol.

Available tools:
- health_check: Check server status and connection
- authenticate: Connect to QuickBooks (requires OAuth setup)
- clear_auth: Disconnect from QuickBooks
- qb_list_companies: List connected QuickBooks companies
- qb_list_<entity>: List various QuickBooks entities (customers, invoices, etc.)
- qb_report: Generate QuickBooks reports

Setup:
1. Configure OAuth credentials as environment variables or in Claude Desktop
2. Use 'authenticate' tool to connect to QuickBooks
3. Use entity tools to query data

For detailed setup instructions, see the project README.
`,
    });


    // Register additional resources and prompts if enabled
    if (config.enableResourcesAndPrompts) {
        try {
            registerQuickBooksResources(mcp);
            logger.info('QuickBooks resources registered successfully');
        } catch (error) {
            logger.error('Failed to register QuickBooks resources', error);
        }

        try {
            registerQuickBooksPrompts(mcp);
            logger.info('QuickBooks prompts registered successfully');
        } catch (error) {
            logger.error('Failed to register QuickBooks prompts', error);
        }
    }

    // Handle process signals gracefully
    process.on('SIGTERM', () => {
        logger.info('Received SIGTERM signal');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        logger.info('Received SIGINT signal');
        process.exit(0);
    });

    // Handle uncaught exceptions and rejections
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception', error);
        // In production, exit after logging; in development, continue for debugging
        if (mode === ServerMode.PRODUCTION) {
            setTimeout(() => process.exit(1), 100);
        }
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled rejection', { reason, promise });
        // In production, exit after logging; in development, continue for debugging
        if (mode === ServerMode.PRODUCTION) {
            setTimeout(() => process.exit(1), 100);
        }
    });

    // Start server
    await mcp.start({ transportType: 'stdio' });
    logger.info(
        `summon server started successfully on stdio transport (${mode} mode)`
    );
}

// Start the server
initializeServer().catch((error) => {
    logger.error('Failed to start MCP server', error);
    setTimeout(() => process.exit(1), 100);
});
