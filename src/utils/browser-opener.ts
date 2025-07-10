/**
 * Browser Opening Utility
 * 
 * Provides a clean interface for opening URLs in the user's default browser.
 * This module can be easily mocked for testing purposes.
 */

import { spawn } from 'child_process';
import { platform } from 'os';

/**
 * Opens a URL in the user's default browser
 * @param url - The URL to open
 */
export function openUrlInBrowser(url: string): void {
  // Prevent browser opening during tests (safety net)
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || (typeof global !== 'undefined' && (global as any).describe)) {
    console.log(`[TEST MODE] Would open browser URL: ${url}`);
    return;
  }
  
  const os = platform();
  let command: string;
  
  switch (os) {
    case 'darwin':
      command = 'open';
      break;
    case 'win32':
      command = 'start';
      break;
    default:
      command = 'xdg-open';
  }
  
  try {
    spawn(command, [url], { detached: true, stdio: 'ignore' }).unref();
  } catch (error) {
    console.error('Failed to open browser:', error);
  }
}