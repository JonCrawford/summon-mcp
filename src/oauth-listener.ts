/**
 * OAuth Callback Listener
 * 
 * Minimal HTTP server for OAuth callback handling
 * Uses pure Node.js to avoid dependencies
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';
import crypto from 'crypto';
import net from 'net';

export interface OAuthListenerConfig {
  port?: number;
  timeout?: number;
  useHttps?: boolean;
}

// OAuth callback port range - ALL ports must be configured in Intuit app
const OAUTH_PORT_RANGE = {
  start: 9741,
  end: 9758
};

export interface OAuthResult {
  code: string;
  state: string;
  realmId?: string;
}

export class OAuthListener {
  private server: http.Server | https.Server | null = null;
  private port: number = 0;
  private resolvePromise: ((result: OAuthResult) => void) | null = null;
  private rejectPromise: ((error: Error) => void) | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private state: string = '';
  private tokenData: { refreshToken?: string; realmId?: string } | null = null;

  constructor(private config: OAuthListenerConfig = {}) {}

  /**
   * Find an available port within the OAuth port range
   */
  private async findFreePort(startPort: number = OAUTH_PORT_RANGE.start): Promise<number> {
    return new Promise((resolve, reject) => {
      // Don't search beyond our configured range
      if (startPort > OAUTH_PORT_RANGE.end) {
        reject(new Error(
          `All OAuth ports (${OAUTH_PORT_RANGE.start}-${OAUTH_PORT_RANGE.end}) are in use. ` +
          `Please wait for other authentication attempts to complete or restart the server.`
        ));
        return;
      }

      const server = net.createServer();
      
      server.listen(startPort, () => {
        const port = (server.address() as net.AddressInfo).port;
        server.close(() => resolve(port));
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // Port in use, try next one in range
          this.findFreePort(startPort + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  generatePKCE(): { verifier: string; challenge: string } {
    // Generate 128 character code verifier
    const verifier = crypto.randomBytes(96).toString('base64url');
    
    // Generate SHA256 challenge
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');

    return { verifier, challenge };
  }

  /**
   * Generate state for CSRF protection
   */
  generateState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Start the OAuth listener
   */
  async start(): Promise<{ port: number; state: string }> {
    // Find available port in the configured range
    this.port = await this.findFreePort();
    
    // Generate state
    this.state = this.generateState();

    // Create server
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.port, () => {
        console.error(`OAuth listener started on http://localhost:${this.port}`);
        resolve();
      });
      
      this.server!.on('error', reject);
    });

    return { port: this.port, state: this.state };
  }

  /**
   * Wait for OAuth callback
   */
  waitForCallback(timeout: number = 300000): Promise<OAuthResult> {
    return new Promise((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;

      // Set timeout
      this.timeoutHandle = setTimeout(() => {
        this.shutdown();
        reject(new Error('OAuth callback timeout'));
      }, timeout);
    });
  }

  /**
   * Handle HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);

    // Handle callback endpoint
    if (url.pathname === '/cb' && req.method === 'GET') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const realmId = url.searchParams.get('realmId');
      const error = url.searchParams.get('error');

      // Handle errors
      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Authentication Failed</title>
            <style>
              body { font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { color: #d73a49; background: #ffeef0; padding: 15px; border-radius: 6px; }
            </style>
          </head>
          <body>
            <h1>Authentication Failed</h1>
            <div class="error">
              <p><strong>Error:</strong> ${this.escapeHtml(error)}</p>
              <p>${this.escapeHtml(url.searchParams.get('error_description') || '')}</p>
            </div>
            <p>You can close this window and try again.</p>
          </body>
          </html>
        `);
        
        if (this.rejectPromise) {
          this.rejectPromise(new Error(`OAuth error: ${error}`));
          this.shutdown();
        }
        return;
      }

      // Validate state
      if (state !== this.state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Invalid Request</title>
            <style>
              body { font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { color: #d73a49; background: #ffeef0; padding: 15px; border-radius: 6px; }
            </style>
          </head>
          <body>
            <h1>Invalid Request</h1>
            <div class="error">
              <p>The authentication request was invalid (state mismatch).</p>
            </div>
            <p>Please close this window and try again.</p>
          </body>
          </html>
        `);
        
        if (this.rejectPromise) {
          this.rejectPromise(new Error('Invalid state parameter'));
          this.shutdown();
        }
        return;
      }

      // Success!
      if (code && state) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Authentication Successful</title>
            <style>
              body { font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .success { color: #28a745; background: #d4edda; padding: 15px; border-radius: 6px; }
              .code { font-family: monospace; background: #f6f8fa; padding: 10px; border-radius: 4px; margin: 10px 0; word-break: break-all; }
              .token-section { margin: 20px 0; padding: 20px; background: #f6f8fa; border-radius: 6px; }
              .token-section h3 { margin-top: 0; }
              .token-value { font-family: monospace; font-size: 12px; background: white; padding: 10px; border-radius: 4px; border: 1px solid #e1e4e8; overflow-wrap: break-word; }
              .instructions { background: #e7f3ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
              .loading { color: #666; font-style: italic; }
            </style>
          </head>
          <body>
            <h1>Authentication Successful!</h1>
            <div class="success">
              <p>✅ QuickBooks has been connected successfully.</p>
            </div>
            
            <p>You can now close this window and return to Claude Desktop.</p>
            
            <div id="token-container" style="display: none;">
              <div class="token-section">
                <h3>🔑 Authentication Tokens</h3>
                <p>If your MCP client requires manual token configuration (e.g., DXT environments), use these values:</p>
                
                <div style="margin: 15px 0;">
                  <strong>Refresh Token:</strong>
                  <div class="token-value" id="refresh-token">Loading...</div>
                </div>
                
                <div style="margin: 15px 0;">
                  <strong>Realm ID (Company ID):</strong>
                  <div class="token-value" id="realm-id">${this.escapeHtml(realmId || 'Not provided')}</div>
                </div>
              </div>
              
              <div class="instructions">
                <h4>Configuration Instructions:</h4>
                <p>Add these environment variables to your MCP client:</p>
                <ul>
                  <li><code>QB_REFRESH_TOKEN</code> - The refresh token above</li>
                  <li><code>QB_CLIENT_ID</code> - Your QuickBooks app client ID</li>
                  <li><code>QB_CLIENT_SECRET</code> - Your QuickBooks app client secret</li>
                </ul>
                <p><small>Note: Refresh tokens expire after 100 days of inactivity.</small></p>
              </div>
            </div>
            
            <script>
              
              // Poll for token data
              let pollCount = 0;
              const maxPolls = 30; // 30 seconds
              
              function pollForTokens() {
                fetch('/tokens')
                  .then(res => res.json())
                  .then(data => {
                    if (data.refreshToken) {
                      document.getElementById('token-container').style.display = 'block';
                      document.getElementById('refresh-token').textContent = data.refreshToken;
                      if (data.realmId) {
                        document.getElementById('realm-id').textContent = data.realmId;
                      }
                    } else if (pollCount < maxPolls) {
                      pollCount++;
                      setTimeout(pollForTokens, 1000);
                    }
                  })
                  .catch(err => {
                    console.error('Failed to fetch tokens:', err);
                    if (pollCount < maxPolls) {
                      pollCount++;
                      setTimeout(pollForTokens, 1000);
                    }
                  });
              }
              
              // Start polling after a short delay to allow token exchange
              setTimeout(pollForTokens, 2000);
            </script>
          </body>
          </html>
        `);

        if (this.resolvePromise) {
          this.resolvePromise({ code, state, realmId: realmId || undefined });
          // Keep server running longer to allow token fetching
          setTimeout(() => this.shutdown(), 35000); // 35 seconds
        }
        return;
      }
    }

    // Handle tokens endpoint
    if (url.pathname === '/tokens' && req.method === 'GET') {
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(this.tokenData || {}));
      return;
    }

    // Handle other requests
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }

  /**
   * Escape HTML for safe display
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Shutdown the server
   */
  private shutdown() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    this.resolvePromise = null;
    this.rejectPromise = null;
  }

  /**
   * Get the callback URL
   */
  getCallbackUrl(): string {
    if (this.config.useHttps) {
      return `https://127-0-0-1.sslip.io:${this.port}/cb`;
    }
    return `http://localhost:${this.port}/cb`;
  }

  /**
   * Set token data to be served via /tokens endpoint
   */
  setTokenData(data: { refreshToken?: string; realmId?: string }) {
    this.tokenData = data;
  }
}