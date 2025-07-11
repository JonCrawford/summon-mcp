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
  
  try {
    switch (os) {
      case 'darwin':
        spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
        break;
      case 'win32':
        // Windows requires using cmd.exe with start command
        // The empty string "" is for the window title
        spawn('cmd.exe', ['/c', 'start', '""', url], { 
          detached: true, 
          stdio: 'ignore',
          shell: false 
        }).unref();
        break;
      default:
        // Linux/Unix
        spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (error) {
    console.error('Failed to open browser:', error);
    // Fallback: try using shell: true as last resort
    try {
      spawn(url, [], { shell: true, detached: true, stdio: 'ignore' }).unref();
    } catch (fallbackError) {
      console.error('Fallback browser opening also failed:', fallbackError);
    }
  }
}