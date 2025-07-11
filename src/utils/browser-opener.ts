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
        // FIXED: Windows requires proper URL quoting to handle ampersands
        // The ampersands (&) in URLs are treated as command separators by cmd.exe
        // unless the URL is properly quoted. This was causing OAuth URLs to be
        // truncated after the first parameter.
        // The empty string "" is for the window title, and the URL is now quoted
        spawn('cmd.exe', ['/c', 'start', '""', `"${url}"`], { 
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
    
    // Enhanced fallback for Windows
    if (os === 'win32') {
      try {
        // Try alternative Windows approach using shell: true
        spawn('start', [`""`, `"${url}"`], { 
          shell: true, 
          detached: true, 
          stdio: 'ignore' 
        }).unref();
        console.error('Windows: Used fallback browser opening method');
      } catch (fallbackError) {
        console.error('Windows: All browser opening methods failed:', fallbackError);
      }
    } else {
      // Original fallback for other platforms
      try {
        spawn(url, [], { shell: true, detached: true, stdio: 'ignore' }).unref();
      } catch (fallbackError) {
        console.error('Fallback browser opening also failed:', fallbackError);
      }
    }
  }
}