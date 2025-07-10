/**
 * Token Migration Utility
 * 
 * Migrates tokens from legacy JSON files to SQLite database
 */

import fs from 'fs/promises';
import path from 'path';
import { TokenDatabase } from './token-database.js';
import { getConfig, isConfigError } from './config.js';

interface LegacyTokenData {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  realmId?: string;
  companyName?: string;
  savedAt?: string;
}

interface LegacyCompanyTokens {
  [companyName: string]: LegacyTokenData;
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Migrate tokens from JSON files to SQLite database
 */
export async function migrateTokens(): Promise<{ migrated: number; errors: string[] }> {
  const config = getConfig();
  if (isConfigError(config)) {
    return { migrated: 0, errors: [config.message] };
  }
  
  const db = new TokenDatabase(config.storageDir);
  const errors: string[] = [];
  let migrated = 0;
  
  // Look for legacy token files in various locations
  const possiblePaths = [
    path.join(process.cwd(), 'tokens.json'),
    path.join(process.cwd(), 'tokens_sandbox.json'),
    path.join(config.storageDir, '..', 'tokens.json'),
    path.join(config.storageDir, '..', 'tokens_sandbox.json'),
    path.join(process.env.HOME || '', '.summon', 'tokens.json'),
    path.join(process.env.HOME || '', '.summon', 'tokens_sandbox.json')
  ];
  
  for (const filePath of possiblePaths) {
    if (await fileExists(filePath)) {
      console.error(`Found legacy token file: ${filePath}`);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        // Handle both single-company and multi-company formats
        if (data.refreshToken && data.realmId) {
          // Single company format
          db.saveToken({
            realmId: data.realmId,
            companyName: data.companyName || 'QuickBooks Company',
            accessToken: data.accessToken || '',
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt || 0
          });
          migrated++;
        } else {
          // Multi-company format
          const companies = data as LegacyCompanyTokens;
          for (const [companyName, tokenData] of Object.entries(companies)) {
            if (tokenData.refreshToken && tokenData.realmId) {
              db.saveToken({
                realmId: tokenData.realmId,
                companyName: tokenData.companyName || companyName,
                accessToken: tokenData.accessToken || '',
                refreshToken: tokenData.refreshToken,
                expiresAt: tokenData.expiresAt || 0
              });
              migrated++;
            }
          }
        }
        
        // Archive the old file
        const archivePath = `${filePath}.migrated-${Date.now()}`;
        await fs.rename(filePath, archivePath);
        console.error(`Archived legacy file to: ${archivePath}`);
        
      } catch (error: any) {
        errors.push(`Failed to migrate ${filePath}: ${error.message}`);
      }
    }
  }
  
  db.close();
  
  return { migrated, errors };
}

/**
 * Run migration if called directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateTokens().then(result => {
    console.log(`Migration complete: ${result.migrated} tokens migrated`);
    if (result.errors.length > 0) {
      console.error('Errors:', result.errors);
      process.exit(1);
    }
  }).catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}