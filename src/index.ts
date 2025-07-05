// Main entry point for the QuickBooks MCP Desktop Extension

export { QuickBooksBroker } from './quickbooks-broker.js';
export { TokenBrokerClient } from './token-broker-client.js';
export { CacheManager } from './cache-manager.js';
export type { Company, QuickBooksToken } from './token-broker-client.js';
export type { QuickBooksBrokerConfig } from './quickbooks-broker.js';

// The server-broker.ts file starts the server immediately when imported
// No need to export a function

// Version info
export const VERSION = '2.0.0';
export const MODE = 'broker';