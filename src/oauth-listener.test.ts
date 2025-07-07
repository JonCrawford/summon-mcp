import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuthListener } from './oauth-listener.js';
import http from 'http';
import net from 'net';
import crypto from 'crypto';

// Mock modules
vi.mock('crypto');
vi.mock('net');
vi.mock('http');

describe.skip('OAuthListener', () => {
  let listener: OAuthListener;
  let mockServer: any;
  let mockNetServer: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock servers
    mockServer = {
      listen: vi.fn((port, host, callback) => {
        if (typeof callback === 'function') callback();
      }),
      close: vi.fn((callback) => {
        if (typeof callback === 'function') callback();
      }),
      on: vi.fn()
    };
    
    mockNetServer = {
      listen: vi.fn((port, host, callback) => {
        if (typeof callback === 'function') callback();
      }),
      close: vi.fn((callback) => {
        if (typeof callback === 'function') callback();
      }),
      address: vi.fn().mockReturnValue({ port: 8080 }),
      on: vi.fn()
    };
    
    // Mock implementations
    vi.mocked(http.createServer).mockReturnValue(mockServer as any);
    vi.mocked(net.createServer).mockReturnValue(mockNetServer as any);
    
    // Mock crypto functions
    vi.mocked(crypto.randomBytes).mockImplementation((size) => ({
      toString: (encoding: string) => `mock-random-${size}-${encoding}`
    } as any));
    
    vi.mocked(crypto.createHash).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('mock-challenge')
    } as any);
    
    listener = new OAuthListener();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findFreePort', () => {
    it('should find a free port successfully', async () => {
      // Make the listener promise resolve immediately
      const startPromise = listener.start();
      
      // Manually trigger the success callback
      const netListenCall = vi.mocked(net.createServer).mock.calls[0];
      const netServer = vi.mocked(net.createServer).mock.results[0].value;
      
      // Simulate successful server start
      setTimeout(() => {
        const listenCallback = mockNetServer.listen.mock.calls[0][2];
        if (listenCallback) listenCallback();
      }, 0);
      
      const result = await startPromise;
      
      expect(result.port).toBe(8080);
      expect(net.createServer).toHaveBeenCalled();
      expect(mockNetServer.listen).toHaveBeenCalledWith(8080, '127.0.0.1', expect.any(Function));
    });

    it('should try next port when current is in use', async () => {
      // First attempt fails with EADDRINUSE
      const errorHandler = vi.fn();
      mockNetServer.on.mockImplementation((event, handler) => {
        if (event === 'error') errorHandler.mockImplementation(handler);
      });
      
      mockNetServer.listen.mockImplementationOnce((port, host, callback) => {
        if (typeof callback === 'function') callback();
        const error: any = new Error('Port in use');
        error.code = 'EADDRINUSE';
        errorHandler(error);
      });
      
      // Second attempt succeeds
      mockNetServer.address.mockReturnValueOnce({ port: 8081 });
      
      const listener2 = new OAuthListener({ port: 8080 });
      const result = await listener2.start();
      
      expect(result.port).toBe(8081);
    });

    it('should use custom port when provided', async () => {
      const listener2 = new OAuthListener({ port: 3000 });
      
      mockNetServer.address.mockReturnValue({ port: 3000 });
      
      const result = await listener2.start();
      
      expect(result.port).toBe(3000);
      expect(mockNetServer.listen).toHaveBeenCalledWith(3000, '127.0.0.1', expect.any(Function));
    });
  });

  describe('generatePKCE', () => {
    it('should generate valid PKCE verifier and challenge', () => {
      const { verifier, challenge } = listener.generatePKCE();
      
      expect(verifier).toBe('mock-random-96-base64url');
      expect(challenge).toBe('mock-challenge');
      expect(crypto.randomBytes).toHaveBeenCalledWith(96);
      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
    });
  });

  describe('generateState', () => {
    it('should generate state token', () => {
      const state = listener.generateState();
      
      expect(state).toBe('mock-random-32-base64url');
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
    });
  });

  describe('start', () => {
    it('should start server and return port and state', async () => {
      const result = await listener.start();
      
      expect(result).toEqual({
        port: 8080,
        state: 'mock-random-32-base64url'
      });
      
      expect(http.createServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(8080, '127.0.0.1', expect.any(Function));
    });

    it('should handle server start errors', async () => {
      mockServer.listen.mockImplementationOnce((port, host, callback) => {
        // Don't call callback, trigger error instead
        return;
      });
      
      mockServer.on.mockImplementationOnce((event, handler) => {
        if (event === 'error') {
          setTimeout(() => handler(new Error('Server start failed')), 0);
        }
      });
      
      await expect(listener.start()).rejects.toThrow('Server start failed');
    });
  });

  describe('waitForCallback', () => {
    beforeEach(async () => {
      await listener.start();
    });

    it('should resolve with OAuth result on successful callback', async () => {
      const mockReq = {
        url: '/cb?code=test-code&state=mock-random-32-base64url&realmId=realm123',
        method: 'GET'
      };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      // Get the request handler
      const requestHandler = vi.mocked(http.createServer).mock.calls[0][0];
      
      // Start waiting for callback
      const callbackPromise = listener.waitForCallback();
      
      // Simulate the callback request
      requestHandler(mockReq as any, mockRes as any);
      
      const result = await callbackPromise;
      
      expect(result).toEqual({
        code: 'test-code',
        state: 'mock-random-32-base64url',
        realmId: 'realm123'
      });
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Authentication Successful'));
    });

    it('should reject on timeout', async () => {
      vi.useFakeTimers();
      
      const callbackPromise = listener.waitForCallback(1000);
      
      // Advance time past timeout
      vi.advanceTimersByTime(1001);
      
      await expect(callbackPromise).rejects.toThrow('OAuth callback timeout');
      
      vi.useRealTimers();
    });

    it('should reject when OAuth returns error', async () => {
      const mockReq = {
        url: '/cb?error=access_denied&error_description=User+denied+access',
        method: 'GET'
      };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      const requestHandler = vi.mocked(http.createServer).mock.calls[0][0];
      const callbackPromise = listener.waitForCallback();
      
      requestHandler(mockReq as any, mockRes as any);
      
      await expect(callbackPromise).rejects.toThrow('OAuth error: access_denied');
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'text/html' });
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Authentication Failed'));
    });

    it('should reject on state mismatch', async () => {
      const mockReq = {
        url: '/cb?code=test-code&state=wrong-state',
        method: 'GET'
      };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      const requestHandler = vi.mocked(http.createServer).mock.calls[0][0];
      const callbackPromise = listener.waitForCallback();
      
      requestHandler(mockReq as any, mockRes as any);
      
      await expect(callbackPromise).rejects.toThrow('Invalid state parameter');
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'text/html' });
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('state mismatch'));
    });
  });

  describe('handleRequest', () => {
    beforeEach(async () => {
      await listener.start();
    });

    it('should return 404 for non-callback URLs', () => {
      const mockReq = {
        url: '/other-endpoint',
        method: 'GET'
      };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      const requestHandler = vi.mocked(http.createServer).mock.calls[0][0];
      requestHandler(mockReq as any, mockRes as any);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/plain' });
      expect(mockRes.end).toHaveBeenCalledWith('Not found');
    });

    it('should handle requests with no URL', () => {
      const mockReq = {
        url: undefined,
        method: 'GET'
      };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      const requestHandler = vi.mocked(http.createServer).mock.calls[0][0];
      requestHandler(mockReq as any, mockRes as any);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/plain' });
    });
  });

  describe('getCallbackUrl', () => {
    it('should return HTTP URL by default', async () => {
      await listener.start();
      
      const url = listener.getCallbackUrl();
      expect(url).toBe('http://localhost:8080/cb');
    });

    it('should return HTTPS URL when configured', async () => {
      const httpsListener = new OAuthListener({ useHttps: true });
      await httpsListener.start();
      
      const url = httpsListener.getCallbackUrl();
      expect(url).toBe('https://127-0-0-1.sslip.io:8080/cb');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML characters', async () => {
      await listener.start();
      
      const mockReq = {
        url: '/cb?error=<script>alert("xss")</script>&error_description=Test+&+description',
        method: 'GET'
      };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      const requestHandler = vi.mocked(http.createServer).mock.calls[0][0];
      listener.waitForCallback().catch(() => {}); // Ignore rejection
      
      requestHandler(mockReq as any, mockRes as any);
      
      const htmlResponse = mockRes.end.mock.calls[0][0];
      expect(htmlResponse).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(htmlResponse).toContain('Test ');
    });
  });

  describe('shutdown', () => {
    it('should clean up resources when shutting down', async () => {
      await listener.start();
      
      vi.useFakeTimers();
      const timeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      // Start waiting with timeout
      listener.waitForCallback(5000).catch(() => {});
      
      // Trigger shutdown via successful callback
      const mockReq = {
        url: '/cb?code=test&state=mock-random-32-base64url',
        method: 'GET'
      };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      const requestHandler = vi.mocked(http.createServer).mock.calls[0][0];
      requestHandler(mockReq as any, mockRes as any);
      
      expect(mockServer.close).toHaveBeenCalled();
      expect(timeoutSpy).toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });

  describe('edge cases', () => {
    it('should handle missing query parameters gracefully', async () => {
      await listener.start();
      
      const mockReq = {
        url: '/cb', // No query params
        method: 'GET'
      };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      const requestHandler = vi.mocked(http.createServer).mock.calls[0][0];
      requestHandler(mockReq as any, mockRes as any);
      
      // When no code or state params, it returns 400 error page
      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'text/html' });
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Invalid Request'));
    });

    it('should handle non-GET requests to callback', async () => {
      await listener.start();
      
      const mockReq = {
        url: '/cb?code=test&state=mock-random-32-base64url',
        method: 'POST' // Wrong method
      };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      const requestHandler = vi.mocked(http.createServer).mock.calls[0][0];
      requestHandler(mockReq as any, mockRes as any);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/plain' });
    });
  });
});