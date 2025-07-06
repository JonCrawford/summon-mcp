/**
 * Token Storage Strategy
 * 
 * Handles token storage across three environments:
 * 1. Local development - File storage
 * 2. Claude Desktop (non-DXT) - OS Keychain if available, else file storage
 * 3. DXT packaged - dxt.saveConfig() when available
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Token storage interface
export interface TokenData {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  realmId?: string;
  companyName?: string;
}

// DXT runtime interface
interface DxtRuntime {
  saveConfig?: (config: Record<string, any>) => Promise<void>;
}

declare global {
  var dxt: DxtRuntime | undefined;
}

// Storage strategy detection
export class TokenStorage {
  private isProduction: boolean;
  private tokenFilePath: string;
  
  constructor() {
    this.isProduction = process.env.QUICKBOOKS_PRODUCTION === 'true';
    const tokenFileName = this.isProduction ? 'tokens.json' : 'tokens_sandbox.json';
    this.tokenFilePath = path.resolve(__dirname, '..', tokenFileName);
  }

  /**
   * Detect available storage methods
   */
  private getStorageCapabilities() {
    return {
      hasDxtSaveConfig: typeof globalThis.dxt?.saveConfig === 'function',
      hasEnvTokens: !!(process.env.QB_REFRESH_TOKEN),
      hasKeychain: false, // TODO: Implement keychain detection
      hasFileSystem: true
    };
  }

  /**
   * Save refresh token using the best available method
   */
  async saveRefreshToken(tokenData: TokenData): Promise<void> {
    const capabilities = this.getStorageCapabilities();
    
    // Priority 1: DXT saveConfig (when in DXT environment)
    if (capabilities.hasDxtSaveConfig && globalThis.dxt?.saveConfig) {
      try {
        await globalThis.dxt.saveConfig({
          qb_refresh_token: tokenData.refreshToken
        });
        // Also save to file as backup
        await this.saveToFile(tokenData);
        return;
      } catch (error) {
        console.error('Failed to save via dxt.saveConfig, falling back to file:', error);
      }
    }
    
    // Priority 2: OS Keychain (future implementation)
    // if (capabilities.hasKeychain) {
    //   await this.saveToKeychain(tokenData);
    //   return;
    // }
    
    // Priority 3: File system (current default)
    await this.saveToFile(tokenData);
  }

  /**
   * Load refresh token using the best available method
   */
  async loadRefreshToken(): Promise<TokenData | null> {
    const capabilities = this.getStorageCapabilities();
    
    // Priority 1: Environment variable (from DXT or .env)
    if (capabilities.hasEnvTokens && process.env.QB_REFRESH_TOKEN) {
      return {
        refreshToken: process.env.QB_REFRESH_TOKEN,
        // These might be stored separately or not at all
        accessToken: process.env.QB_ACCESS_TOKEN,
        expiresAt: process.env.QB_TOKEN_EXPIRES ? parseInt(process.env.QB_TOKEN_EXPIRES) : undefined,
        realmId: process.env.QB_REALM_ID,
        companyName: process.env.QB_COMPANY_NAME
      };
    }
    
    // Priority 2: OS Keychain (future implementation)
    // if (capabilities.hasKeychain) {
    //   const data = await this.loadFromKeychain();
    //   if (data) return data;
    // }
    
    // Priority 3: File system
    return await this.loadFromFile();
  }

  /**
   * Clear stored tokens
   */
  async clearTokens(): Promise<void> {
    const capabilities = this.getStorageCapabilities();
    
    // Clear from DXT if available
    if (capabilities.hasDxtSaveConfig && globalThis.dxt?.saveConfig) {
      try {
        await globalThis.dxt.saveConfig({
          qb_refresh_token: ''
        });
      } catch (error) {
        console.error('Failed to clear via dxt.saveConfig:', error);
      }
    }
    
    // Always clear from file
    try {
      await fs.unlink(this.tokenFilePath);
    } catch (error) {
      // File might not exist
    }
  }

  /**
   * File-based storage (with optional encryption)
   */
  private async saveToFile(tokenData: TokenData): Promise<void> {
    const data = {
      ...tokenData,
      savedAt: new Date().toISOString()
    };
    
    // TODO: Add encryption for file storage
    await fs.writeFile(
      this.tokenFilePath,
      JSON.stringify(data, null, 2),
      'utf-8'
    );
  }

  /**
   * Load from file storage
   */
  private async loadFromFile(): Promise<TokenData | null> {
    try {
      const data = await fs.readFile(this.tokenFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if we have valid credentials to attempt OAuth
   */
  hasOAuthCredentials(): boolean {
    return !!(
      (process.env.QB_CLIENT_ID || process.env.INTUIT_CLIENT_ID) &&
      (process.env.QB_CLIENT_SECRET || process.env.INTUIT_CLIENT_SECRET)
    );
  }

  /**
   * Get OAuth credentials from environment
   */
  getOAuthCredentials() {
    return {
      clientId: process.env.QB_CLIENT_ID || process.env.INTUIT_CLIENT_ID || '',
      clientSecret: process.env.QB_CLIENT_SECRET || process.env.INTUIT_CLIENT_SECRET || ''
    };
  }
}