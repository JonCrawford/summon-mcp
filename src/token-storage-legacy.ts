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

// Multi-company token storage
export interface CompanyTokens {
  [companyName: string]: TokenData;
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
    this.isProduction = process.env.QB_PRODUCTION === 'true';
    const tokenFileName = this.isProduction ? 'tokens.json' : 'tokens_sandbox.json';
    this.tokenFilePath = path.resolve(__dirname, '..', tokenFileName);
  }

  /**
   * Detect available storage methods
   */
  private getStorageCapabilities() {
    return {
      hasDxtSaveConfig: typeof globalThis.dxt?.saveConfig === 'function',
      hasEnvTokens: !!(process.env.QB_REFRESH_TOKEN || process.env.QB_COMPANIES),
      hasKeychain: false, // TODO: Implement keychain detection
      hasFileSystem: !process.env.DXT_ENVIRONMENT && !process.env.QUICKBOOKS_NO_FILE_LOGGING // Disable file system in DXT
    };
  }

  /**
   * Save refresh token using the best available method
   */
  async saveRefreshToken(tokenData: TokenData): Promise<void> {
    console.error('TokenStorage.saveRefreshToken: Starting save...');
    const capabilities = this.getStorageCapabilities();
    console.error('TokenStorage.saveRefreshToken: Capabilities:', capabilities);
    
    const companyName = tokenData.companyName || 'Default Company';
    
    // Priority 1: DXT saveConfig (when in DXT environment)
    if (capabilities.hasDxtSaveConfig && globalThis.dxt?.saveConfig) {
      console.error('TokenStorage.saveRefreshToken: Using DXT saveConfig for multi-tenant storage');
      try {
        // Load existing companies
        let companies: CompanyTokens = {};
        if (process.env.QB_COMPANIES) {
          try {
            companies = JSON.parse(process.env.QB_COMPANIES);
          } catch (e) {
            console.error('Failed to parse existing QB_COMPANIES:', e);
          }
        }
        
        // Update company data
        companies[companyName] = {
          refreshToken: tokenData.refreshToken,
          accessToken: tokenData.accessToken,
          expiresAt: tokenData.expiresAt,
          realmId: tokenData.realmId,
          companyName: companyName
        };
        
        // Save the entire companies object
        await globalThis.dxt.saveConfig({
          qb_companies: JSON.stringify(companies)
        });
        
        console.error(`TokenStorage.saveRefreshToken: Saved company "${companyName}" via DXT`);
        return;
      } catch (error) {
        console.error('Failed to save via dxt.saveConfig:', error);
      }
    }
    
    // Priority 2: OS Keychain (future implementation)
    // if (capabilities.hasKeychain) {
    //   await this.saveToKeychain(tokenData);
    //   return;
    // }
    
    // Priority 3: File system (current default)
    if (capabilities.hasFileSystem) {
      console.error('TokenStorage.saveRefreshToken: Using file system storage');
      await this.saveToFile(tokenData);
      console.error('TokenStorage.saveRefreshToken: Save complete');
    }
  }

  /**
   * Load refresh token using the best available method
   */
  async loadRefreshToken(companyName?: string): Promise<TokenData | null> {
    const capabilities = this.getStorageCapabilities();
    
    // Priority 1: Multi-company environment variable (DXT)
    if (capabilities.hasEnvTokens && process.env.QB_COMPANIES) {
      try {
        const companies: CompanyTokens = JSON.parse(process.env.QB_COMPANIES);
        if (companyName && companies[companyName]) {
          return companies[companyName];
        }
        // Return first company if no name specified
        const firstCompany = Object.values(companies)[0];
        return firstCompany || null;
      } catch (error) {
        console.error('Failed to parse QB_COMPANIES:', error);
      }
    }
    
    // Priority 2: Single company environment variable (legacy)
    if (capabilities.hasEnvTokens && process.env.QB_REFRESH_TOKEN) {
      // Check if the token is a template string (DXT substitution failure)
      if (process.env.QB_REFRESH_TOKEN.includes('${user_config')) {
        console.error('TokenStorage: Ignoring template string in QB_REFRESH_TOKEN:', process.env.QB_REFRESH_TOKEN);
        // Fall through to file storage
      } else {
        return {
          refreshToken: process.env.QB_REFRESH_TOKEN,
          accessToken: process.env.QB_ACCESS_TOKEN,
          expiresAt: process.env.QB_TOKEN_EXPIRES ? parseInt(process.env.QB_TOKEN_EXPIRES) : undefined,
          realmId: process.env.QB_REALM_ID,
          companyName: process.env.QB_COMPANY_NAME || 'Default Company'
        };
      }
    }
    
    // Priority 3: OS Keychain (future implementation)
    // if (capabilities.hasKeychain) {
    //   const data = await this.loadFromKeychain();
    //   if (data) return data;
    // }
    
    // Priority 4: File system (not available in DXT)
    if (capabilities.hasFileSystem) {
      return await this.loadFromFile(companyName);
    }
    
    return null;
  }

  /**
   * Clear stored tokens for a specific company or all companies
   */
  async clearTokens(companyName?: string): Promise<void> {
    const capabilities = this.getStorageCapabilities();
    
    // Clear from DXT if available
    if (capabilities.hasDxtSaveConfig && globalThis.dxt?.saveConfig) {
      try {
        if (companyName) {
          // Clear specific company
          let companies: CompanyTokens = {};
          if (process.env.QB_COMPANIES) {
            try {
              companies = JSON.parse(process.env.QB_COMPANIES);
              delete companies[companyName];
            } catch (e) {
              console.error('Failed to parse QB_COMPANIES:', e);
            }
          }
          await globalThis.dxt.saveConfig({
            qb_companies: JSON.stringify(companies)
          });
        } else {
          // Clear all companies
          await globalThis.dxt.saveConfig({
            qb_companies: ''
          });
        }
      } catch (error) {
        console.error('Failed to clear via dxt.saveConfig:', error);
      }
    }
    
    // Clear from file if available
    if (capabilities.hasFileSystem) {
      try {
        if (companyName) {
          // Clear specific company from file
          const allData = await this.loadAllFromFile();
          delete allData[companyName];
          if (Object.keys(allData).length > 0) {
            await fs.writeFile(this.tokenFilePath, JSON.stringify(allData, null, 2), 'utf-8');
          } else {
            await fs.unlink(this.tokenFilePath);
          }
        } else {
          // Clear all
          await fs.unlink(this.tokenFilePath);
        }
      } catch (error) {
        // File might not exist
      }
    }
  }

  /**
   * List all connected companies
   */
  async listCompanies(): Promise<string[]> {
    const capabilities = this.getStorageCapabilities();
    
    // Check multi-company environment variable
    if (capabilities.hasEnvTokens && process.env.QB_COMPANIES) {
      try {
        const companies: CompanyTokens = JSON.parse(process.env.QB_COMPANIES);
        return Object.keys(companies);
      } catch (error) {
        console.error('Failed to parse QB_COMPANIES:', error);
      }
    }
    
    // Check single company environment variable
    if (capabilities.hasEnvTokens && process.env.QB_REFRESH_TOKEN) {
      const companyName = process.env.QB_COMPANY_NAME || 'Default Company';
      return [companyName];
    }
    
    // Check file system
    if (capabilities.hasFileSystem) {
      const companies = await this.loadAllFromFile();
      return Object.keys(companies);
    }
    
    return [];
  }

  /**
   * File-based storage (with optional encryption)
   */
  private async saveToFile(tokenData: TokenData): Promise<void> {
    // Skip file operations in DXT environment
    if (process.env.DXT_ENVIRONMENT || process.env.QUICKBOOKS_NO_FILE_LOGGING) {
      console.error('TokenStorage.saveToFile: Skipping file write in DXT/read-only environment');
      return;
    }

    console.error(`TokenStorage.saveToFile: Saving to ${this.tokenFilePath}`);
    
    // Load existing data for multi-company support
    let allData: CompanyTokens = {};
    try {
      const existing = await fs.readFile(this.tokenFilePath, 'utf-8');
      allData = JSON.parse(existing);
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
    }
    
    // Update company data
    const companyName = tokenData.companyName || 'Default Company';
    allData[companyName] = {
      ...tokenData,
      savedAt: new Date().toISOString()
    } as TokenData & { savedAt: string };
    
    console.error('TokenStorage.saveToFile: Token data to save:', {
      companyName,
      hasRefreshToken: !!tokenData.refreshToken,
      hasAccessToken: !!tokenData.accessToken,
      realmId: tokenData.realmId
    });
    
    try {
      // TODO: Add encryption for file storage
      await fs.writeFile(
        this.tokenFilePath,
        JSON.stringify(allData, null, 2),
        'utf-8'
      );
      console.error('TokenStorage.saveToFile: File written successfully');
      
      // Verify file was written
      const stats = await fs.stat(this.tokenFilePath);
      console.error(`TokenStorage.saveToFile: File size: ${stats.size} bytes`);
    } catch (error: any) {
      console.error('TokenStorage.saveToFile: Write error:', error);
      throw error;
    }
  }

  /**
   * Load from file storage
   */
  private async loadFromFile(companyName?: string): Promise<TokenData | null> {
    try {
      const data = await fs.readFile(this.tokenFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Handle multi-company format
      if (parsed && typeof parsed === 'object' && !parsed.refreshToken) {
        // This is multi-company format
        if (companyName && parsed[companyName]) {
          return parsed[companyName];
        }
        // Return first company if no name specified
        const firstCompany = Object.values(parsed)[0] as TokenData;
        return firstCompany || null;
      }
      
      // Legacy single company format
      return parsed;
    } catch (error) {
      return null;
    }
  }

  /**
   * Load all companies from file storage
   */
  private async loadAllFromFile(): Promise<CompanyTokens> {
    try {
      const data = await fs.readFile(this.tokenFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Handle multi-company format
      if (parsed && typeof parsed === 'object' && !parsed.refreshToken) {
        return parsed;
      }
      
      // Legacy single company format
      const companyName = parsed.companyName || 'Default Company';
      return { [companyName]: parsed };
    } catch (error) {
      return {};
    }
  }

  /**
   * Check if we have valid credentials to attempt OAuth
   */
  hasOAuthCredentials(): boolean {
    return !!(process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET);
  }

  /**
   * Get OAuth credentials from environment
   */
  getOAuthCredentials() {
    return {
      clientId: process.env.QB_CLIENT_ID || '',
      clientSecret: process.env.QB_CLIENT_SECRET || ''
    };
  }
}