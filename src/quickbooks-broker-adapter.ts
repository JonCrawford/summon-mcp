/**
 * Adapter to make QuickBooksBroker (multi-tenant) compatible with resources that expect
 * the single-tenant broker interface
 */

import { QuickBooksBroker } from './quickbooks-broker-mt.js';

// Global instance of the broker that will be set by the server
let globalBroker: QuickBooksBroker | null = null;

/**
 * Set the global broker instance
 */
export function setBroker(broker: QuickBooksBroker): void {
  globalBroker = broker;
}

/**
 * Get QuickBooks client for a specific realm ID (defaults to first available company)
 */
export async function getQBOClient(realmId?: string): Promise<any> {
  if (!globalBroker) {
    throw new Error('QuickBooks authentication required');
  }
  
  return globalBroker.getQBOClient(realmId);
}

/**
 * List all connected companies
 */
export async function listCompanies(): Promise<{ name: string; realmId: string }[]> {
  if (!globalBroker) {
    // Return empty array if broker not initialized yet
    return [];
  }
  
  return globalBroker.listCompanies();
}

/**
 * Clear client cache
 */
export function clearClientCache(): void {
  if (!globalBroker) {
    // Silently ignore if broker not initialized
    return;
  }
  
  globalBroker.clearClientCache();
}