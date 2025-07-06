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

  constructor(private config: OAuthListenerConfig = {}) {}

  /**
   * Find an available port
   */
  private async findFreePort(startPort: number = 8080): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      
      server.listen(startPort, '127.0.0.1', () => {
        const port = (server.address() as net.AddressInfo).port;
        server.close(() => resolve(port));
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // Port in use, try next one
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
    // Find available port
    this.port = await this.findFreePort(this.config.port || 8080);
    
    // Generate state
    this.state = this.generateState();

    // Create server
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.port, '127.0.0.1', () => {
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
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Authentication Successful</title>
            <style>
              body { font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .success { color: #28a745; background: #d4edda; padding: 15px; border-radius: 6px; }
              .code { font-family: monospace; background: #f6f8fa; padding: 10px; border-radius: 4px; margin: 10px 0; }
            </style>
          </head>
          <body>
            <h1>Authentication Successful!</h1>
            <div class="success">
              <p>QuickBooks has been connected successfully.</p>
            </div>
            <p>You can now close this window and return to Claude Desktop.</p>
            <script>
              // Auto-close after 3 seconds
              setTimeout(() => {
                window.close();
              }, 3000);
            </script>
          </body>
          </html>
        `);

        if (this.resolvePromise) {
          this.resolvePromise({ code, state, realmId: realmId || undefined });
          this.shutdown();
        }
        return;
      }
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
}