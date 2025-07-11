/**
 * QuickBooks Broker - Main integration point for MCP tools
 *
 * Handles:
 * - OAuth authentication flow
 * - Token management
 * - QuickBooks API client creation
 */

import QuickBooks from 'node-quickbooks';
import { TokenManager } from './token-manager.js';
import { TokenData } from './token-storage.js';
import { OAuthListener } from './oauth-listener.js';
import { openUrlInBrowser } from './utils/browser-opener.js';
import { getConfig, getRedirectUri } from './config.js';
import {
    AuthenticationError,
    CompanyError,
    ErrorFactory,
    issummonError,
} from './errors/index.js';

// Singleton instances
let tokenManager: TokenManager | null = null;
let qbClient: QuickBooks | null = null;

/**
 * Error codes for MCP responses
 * @deprecated Use ErrorFactory instead
 */
export enum ErrorCode {
    NEEDS_AUTH = 'QUICKBOOKS_NEEDS_AUTH',
    AUTH_FAILED = 'QUICKBOOKS_AUTH_FAILED',
    TOKEN_EXPIRED = 'QUICKBOOKS_TOKEN_EXPIRED',
    API_ERROR = 'QUICKBOOKS_API_ERROR',
}

/**
 * Initialize token manager
 */
function getTokenManager(): TokenManager {
    if (!tokenManager) {
        tokenManager = new TokenManager();
    }
    return tokenManager;
}

/**
 * Ensure we have valid authentication
 */
export async function ensureAuth(): Promise<boolean> {
    const tm = getTokenManager();

    // Check if we have a refresh token
    if (await tm.hasRefreshToken()) {
        try {
            // Try to get access token (will refresh if needed)
            await tm.getAccessToken();
            return true;
        } catch (error: any) {
            // If refresh token is expired, we need to re-auth
            if (error.message.includes('expired')) {
                return false;
            }
            throw error;
        }
    }

    return false;
}

/**
 * Start OAuth flow
 */
export async function startOAuthFlow(): Promise<{
    authUrl: string;
    message: string;
    refreshToken?: string;
    realmId?: string;
}> {
    const tm = getTokenManager();
    const listener = new OAuthListener();

    try {
        console.error('OAuth: Starting OAuth flow...');

        // Start the OAuth listener
        const { port, state } = await listener.start();
        console.error(
            `OAuth: Listener started on port ${port}, state: ${state}`
        );

        // Get configuration (will throw ConfigurationError if invalid)
        const config = getConfig();

        // Generate auth URL with proper redirect URI using dynamic port
        const redirectUri = getRedirectUri(config, port);

        console.error(
            `OAuth: Using ${config.environment} mode with redirect URI: ${redirectUri}`
        );

        const authUrl = await tm.generateAuthUrl(state, redirectUri);
        console.error(`OAuth: Generated auth URL: ${authUrl}`);

        // Open browser in background
        openBrowser(authUrl);

        // Wait for callback
        console.error('OAuth: Waiting for callback...');
        const result = await listener.waitForCallback();
        console.error(
            `OAuth: Callback received - code: ${result.code?.substring(
                0,
                10
            )}..., realmId: ${result.realmId}`
        );

        // Exchange code for tokens
        console.error('OAuth: Exchanging authorization code for tokens...');
        let tokenData: TokenData | null = null;
        try {
            // Exchange code and get the actual token data
            tokenData = await tm.exchangeCodeForTokens(
                result.code,
                result.realmId!,
                redirectUri
            );
            console.error('OAuth: Token exchange successful!');

            // Set the actual token data on the listener (not from storage which may have template strings)
            if (tokenData) {
                listener.setTokenData({
                    refreshToken: tokenData.refreshToken,
                    realmId: tokenData.realmId,
                });
            }
        } catch (exchangeError: any) {
            console.error('OAuth: Token exchange failed:', exchangeError);
            console.error(
                'OAuth: Error details:',
                JSON.stringify(exchangeError, null, 2)
            );
            throw exchangeError;
        }

        // Clear client cache to force recreation with new tokens
        qbClient = null;

        return {
            authUrl,
            message:
                'Authentication successful! QuickBooks has been connected.',
            refreshToken: tokenData?.refreshToken,
            realmId: tokenData?.realmId,
        };
    } catch (error: any) {
        console.error('OAuth: Flow failed:', error);
        console.error('OAuth: Error stack:', error.stack);

        // Re-throw summon errors as-is
        if (issummonError(error)) {
            throw error;
        }

        // Convert to appropriate error type
        throw ErrorFactory.fromOAuth(error, 'start_oauth_flow');
    }
}

/**
 * Open browser for OAuth
 */
function openBrowser(url: string) {
    openUrlInBrowser(url);
}

/**
 * Get authenticated QuickBooks client
 */
export async function getQBOClient(): Promise<QuickBooks> {
    try {
        // Check if we have valid auth
        if (!(await ensureAuth())) {
            throw new AuthenticationError(
                'QuickBooks authentication required. Please use the authenticate tool to connect.',
                true,
                undefined,
                { needsAuth: true }
            );
        }

        // Return cached client if available
        if (qbClient) {
            return qbClient;
        }

        // Create new client
        const tm = getTokenManager();
        const accessToken = await tm.getAccessToken();
        const metadata = await tm.getTokenMetadata();

        if (!metadata?.realmId) {
            throw new CompanyError('No QuickBooks company connected');
        }

        // Get configuration (will throw ConfigurationError if invalid)
        const config = getConfig();

        qbClient = new QuickBooks(
            config.clientId,
            config.clientSecret,
            accessToken,
            false, // No token secret for OAuth 2.0
            metadata.realmId,
            !config.isProduction, // Use sandbox = true when NOT in production
            false, // Disable debug for MCP stdio transport
            null, // Minor version
            '2.0', // OAuth version
            '' // Refresh token not needed here
        );

        return qbClient;
    } catch (error: any) {
        // Re-throw summon errors as-is
        if (issummonError(error)) {
            throw error;
        }

        // Convert to appropriate error type
        throw ErrorFactory.fromGenericError(error, 'qbo_client_creation');
    }
}

/**
 * List connected companies
 */
export async function listCompanies(): Promise<string[]> {
    const tm = getTokenManager();
    const metadata = await tm.getTokenMetadata();

    if (!metadata?.companyName) {
        return [];
    }

    return [metadata.companyName];
}

/**
 * Clear cached QuickBooks client (forces recreation on next call)
 */
export function clearClientCache(): void {
    qbClient = null;
}

/**
 * Clear all authentication
 */
export async function disconnect(): Promise<void> {
    const tm = getTokenManager();
    await tm.clearTokens();
    qbClient = null;
}
