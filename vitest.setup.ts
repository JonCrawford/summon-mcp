/**
 * Vitest Global Setup
 * 
 * This file runs before ALL tests to set up global mocks and configurations
 * that should be consistent across the entire test suite.
 */

import { vi } from 'vitest';

// Global mock for browser opener to prevent actual browser opening during tests
const mockOpenUrlInBrowser = vi.fn().mockImplementation((url: string) => {
  // Log the URL that would have been opened for debugging
  console.log(`[TEST] Would open browser URL: ${url}`);
  return Promise.resolve();
});

vi.mock('src/utils/browser-opener.js', () => ({
  openUrlInBrowser: mockOpenUrlInBrowser
}));

// Make the mock available globally for test verification
global.mockOpenUrlInBrowser = mockOpenUrlInBrowser;

// Optional: Mock other commonly problematic modules
// vi.mock('child_process', () => ({
//   spawn: vi.fn()
// }));

console.log('[VITEST SETUP] Global mocks configured - browser opening prevented');