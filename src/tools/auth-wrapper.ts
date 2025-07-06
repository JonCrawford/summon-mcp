/**
 * Auth wrapper for MCP tools
 * Handles OAuth authentication flow when needed
 */

import { startOAuthFlow, ErrorCode } from '../quickbooks-broker.js';

/**
 * Wrap a tool execution function with OAuth error handling
 */
export function withAuth<TArgs, TReturn>(
  executeFunction: (args: TArgs) => Promise<TReturn>
): (args: TArgs) => Promise<TReturn> {
  return async (args: TArgs) => {
    try {
      // Try to execute the function
      return await executeFunction(args);
    } catch (error: any) {
      // Check if it's an auth error
      let errorData;
      try {
        errorData = JSON.parse(error.message);
      } catch {
        // Not a JSON error, re-throw
        throw error;
      }

      if (errorData.code === ErrorCode.NEEDS_AUTH && errorData.needsAuth) {
        // Start OAuth flow
        const { authUrl, message } = await startOAuthFlow();
        
        // Return a user-friendly message
        return {
          content: [{
            type: 'text',
            text: `QuickBooks authentication required!\n\n` +
                  `I've opened your browser to connect to QuickBooks. ` +
                  `Please authorize the connection and then try your request again.\n\n` +
                  `If the browser didn't open, visit: ${authUrl}\n\n` +
                  `Status: ${message}`
          }]
        } as any;
      }

      // Other errors, re-throw
      throw error;
    }
  };
}