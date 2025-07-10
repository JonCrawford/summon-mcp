import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openUrlInBrowser } from './browser-opener.js';

describe('Browser Opener Utility', () => {
  let consoleSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.log to capture test mode output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should prevent browser opening during tests', () => {
    openUrlInBrowser('https://example.com');
    
    expect(consoleSpy).toHaveBeenCalledWith('[TEST MODE] Would open browser URL: https://example.com');
  });

  it('should handle different test environments', () => {
    // Test with NODE_ENV=test
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    
    openUrlInBrowser('https://test.example.com');
    
    expect(consoleSpy).toHaveBeenCalledWith('[TEST MODE] Would open browser URL: https://test.example.com');
    
    // Restore original environment
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should handle VITEST environment variable', () => {
    // Test with VITEST=true
    const originalVitest = process.env.VITEST;
    process.env.VITEST = 'true';
    
    openUrlInBrowser('https://vitest.example.com');
    
    expect(consoleSpy).toHaveBeenCalledWith('[TEST MODE] Would open browser URL: https://vitest.example.com');
    
    // Restore original environment
    process.env.VITEST = originalVitest;
  });

  it('should handle global describe detection', () => {
    // The global describe function should be present in test environment
    expect(typeof global.describe).toBe('function');
    
    openUrlInBrowser('https://global.example.com');
    
    expect(consoleSpy).toHaveBeenCalledWith('[TEST MODE] Would open browser URL: https://global.example.com');
  });
});