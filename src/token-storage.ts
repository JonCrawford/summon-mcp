/**
 * Token Storage V2 - SQLite-based implementation
 * 
 * Simplified storage strategy using SQLite database for all environments
 */

import { TokenDatabase, TokenData as DBTokenData, CompanyInfo } from './token-database.js';
import { getConfig } from './config.js';

// Token storage interface (same as original for compatibility)
export interface TokenData {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  realmId?: string;
  companyName?: string;
}

// Storage strategy using SQLite
export class TokenStorage {
  private db: TokenDatabase | null = null;
  
  /**
   * Get or create database instance
   */
  private getDatabase(): TokenDatabase {
    if (!this.db) {
      const config = getConfig();
      this.db = new TokenDatabase(config.storageDir);
    }
    return this.db;
  }
  
  /**
   * Save refresh token and related data
   */
  async saveRefreshToken(tokenData: TokenData): Promise<void> {
    if (!tokenData.realmId) {
      throw new Error('realmId is required for token storage');
    }
    
    const db = this.getDatabase();
    
    const dbTokenData: DBTokenData = {
      realmId: tokenData.realmId,
      companyName: tokenData.companyName || 'QuickBooks Company',
      accessToken: tokenData.accessToken || '',
      refreshToken: tokenData.refreshToken,
      expiresAt: tokenData.expiresAt || 0
    };
    
    db.saveToken(dbTokenData);
    
    console.error(`TokenStorage: Saved company "${dbTokenData.companyName}" (${dbTokenData.realmId})`);
  }
  
  /**
   * Load refresh token by company name or realm ID
   */
  async loadRefreshToken(companyNameOrRealmId?: string): Promise<TokenData | null> {
    const db = this.getDatabase();
    
    if (companyNameOrRealmId) {
      // Try to load by realm ID first (more specific)
      let dbToken = db.loadToken(companyNameOrRealmId);
      
      // If not found, try by company name
      if (!dbToken) {
        dbToken = db.loadTokenByCompanyName(companyNameOrRealmId);
      }
      
      if (dbToken) {
        return this.dbTokenToTokenData(dbToken);
      }
    } else {
      // No specific company requested, return first available
      const companies = db.listCompanies();
      if (companies.length > 0) {
        const dbToken = db.loadToken(companies[0].realmId);
        if (dbToken) {
          return this.dbTokenToTokenData(dbToken);
        }
      }
    }
    
    return null;
  }
  
  /**
   * Clear stored tokens for a specific company or all companies
   */
  async clearTokens(companyNameOrRealmId?: string): Promise<void> {
    const db = this.getDatabase();
    db.clearTokens(companyNameOrRealmId);
  }
  
  /**
   * List all connected companies
   */
  async listCompanies(): Promise<string[]> {
    const db = this.getDatabase();
    const companies = db.listCompanies();
    return companies.map(c => c.companyName);
  }
  
  /**
   * Get detailed company information (for LLM context)
   */
  async getCompanyInfo(): Promise<CompanyInfo[]> {
    const db = this.getDatabase();
    return db.listCompanies();
  }
  
  /**
   * Check if we have any tokens stored
   */
  async hasTokens(): Promise<boolean> {
    const db = this.getDatabase();
    return db.hasTokens();
  }
  
  /**
   * Convert database token format to legacy format
   */
  private dbTokenToTokenData(dbToken: DBTokenData): TokenData {
    return {
      refreshToken: dbToken.refreshToken || '',
      accessToken: dbToken.accessToken,
      expiresAt: dbToken.expiresAt,
      realmId: dbToken.realmId,
      companyName: dbToken.companyName
    };
  }
  
  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
  
  /**
   * Check if we have valid credentials to attempt OAuth
   */
  hasOAuthCredentials(): boolean {
    const isDXT = process.env.DXT_ENVIRONMENT === 'true';
    
    if (isDXT) {
      // In DXT, only check standard credential names
      return !!(process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET);
    }
    
    // In non-DXT environments, check all possible credential combinations
    const hasQB = !!(process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET);
    const hasIntuit = !!(process.env.INTUIT_CLIENT_ID && process.env.INTUIT_CLIENT_SECRET);
    const hasQBProd = !!(process.env.QB_CLIENT_ID_PRODUCTION && process.env.QB_CLIENT_SECRET_PRODUCTION);
    const hasIntuitProd = !!(process.env.INTUIT_CLIENT_ID_PRODUCTION && process.env.INTUIT_CLIENT_SECRET_PRODUCTION);
    return hasQB || hasIntuit || hasQBProd || hasIntuitProd;
  }
  
  /**
   * Get OAuth credentials from environment
   */
  getOAuthCredentials() {
    const isProduction = process.env.QB_PRODUCTION === 'true' || process.env.QUICKBOOKS_PRODUCTION === 'true';
    const isDXT = process.env.DXT_ENVIRONMENT === 'true';
    
    let clientId: string = '';
    let clientSecret: string = '';
    
    if (isDXT) {
      // DXT always uses standard credential names
      clientId = process.env.QB_CLIENT_ID || '';
      clientSecret = process.env.QB_CLIENT_SECRET || '';
    } else if (isProduction) {
      // In production (non-DXT), check production-specific credentials first
      clientId = process.env.QB_CLIENT_ID_PRODUCTION || 
                 process.env.INTUIT_CLIENT_ID_PRODUCTION ||
                 process.env.QB_CLIENT_ID || 
                 process.env.INTUIT_CLIENT_ID || '';
      clientSecret = process.env.QB_CLIENT_SECRET_PRODUCTION || 
                     process.env.INTUIT_CLIENT_SECRET_PRODUCTION ||
                     process.env.QB_CLIENT_SECRET || 
                     process.env.INTUIT_CLIENT_SECRET || '';
    } else {
      // In sandbox, use standard credentials
      clientId = process.env.QB_CLIENT_ID || 
                 process.env.INTUIT_CLIENT_ID || '';
      clientSecret = process.env.QB_CLIENT_SECRET || 
                     process.env.INTUIT_CLIENT_SECRET || '';
    }
    
    return {
      clientId,
      clientSecret
    };
  }
}