/**
 * TypeScript declarations for Vitest globals
 */

import { vi } from 'vitest';

declare global {
  var mockOpenUrlInBrowser: ReturnType<typeof vi.fn>;
}