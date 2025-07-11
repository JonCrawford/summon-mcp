/**
 * JSON-based Token Storage
 * 
 * Simple, cross-platform token storage using JSON files
 */

import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from './config.js';

export interface TokenData {
  realmId: string;
  companyName: string;
  accessToken?: string;
  refreshToken: string;
  expiresAt?: number;
}

export interface CompanyInfo {
  realmId: string;
  companyName: string;
}

interface TokenRecord {
  [realmId: string]: TokenData;
}

export class TokenDatabase {
  private filePath: string;
  private environment: string;
  
  constructor(storageDir: string) {
    // Always create .summon subdirectory
    const summonDir = path.join(storageDir, '.summon');
    
    // Ensure storage directory exists
    if (!fs.existsSync(summonDir)) {
      fs.mkdirSync(summonDir, { recursive: true });
    }
    
    // Determine environment
    const isProduction = process.env.QB_PRODUCTION === 'true' || 
                        process.env.QUICKBOOKS_PRODUCTION === 'true';
    this.environment = isProduction ? 'production' : 'sandbox';
    
    // Use different files for different environments
    const fileName = `tokens-${this.environment}.json`;
    this.filePath = path.join(summonDir, fileName);
    
    console.error(`[TokenDatabase] Using JSON storage at: ${this.filePath}`);
  }
  
  private loadTokens(): TokenRecord {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(data) || {};
      }
    } catch (error) {
      console.error('[TokenDatabase] Error loading tokens:', error);
    }
    return {};
  }
  
  private saveTokens(tokens: TokenRecord): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(tokens, null, 2));
    } catch (error) {
      console.error('[TokenDatabase] Error saving tokens:', error);
      throw error;
    }
  }
  
  saveToken(tokenData: TokenData): void {
    const tokens = this.loadTokens();
    tokens[tokenData.realmId] = tokenData;
    this.saveTokens(tokens);
    console.error(`[TokenDatabase] Saved token for realm ${tokenData.realmId}, company "${tokenData.companyName}"`);
  }
  
  loadToken(realmId: string): TokenData | null {
    const tokens = this.loadTokens();
    return tokens[realmId] || null;
  }
  
  loadTokenByCompanyName(companyName: string): TokenData | null {
    const tokens = this.loadTokens();
    for (const token of Object.values(tokens)) {
      if (token.companyName === companyName) {
        return token;
      }
    }
    return null;
  }
  
  clearTokens(realmIdOrCompanyName?: string): void {
    if (!realmIdOrCompanyName) {
      // Clear all tokens
      this.saveTokens({});
      console.error('[TokenDatabase] Cleared all tokens');
      return;
    }
    
    const tokens = this.loadTokens();
    
    // Try to delete by realm ID first
    if (tokens[realmIdOrCompanyName]) {
      delete tokens[realmIdOrCompanyName];
      this.saveTokens(tokens);
      console.error(`[TokenDatabase] Cleared token for realm ${realmIdOrCompanyName}`);
      return;
    }
    
    // Try to delete by company name
    for (const [realmId, token] of Object.entries(tokens)) {
      if (token.companyName === realmIdOrCompanyName) {
        delete tokens[realmId];
        this.saveTokens(tokens);
        console.error(`[TokenDatabase] Cleared token for company "${realmIdOrCompanyName}"`);
        return;
      }
    }
  }
  
  listCompanies(): CompanyInfo[] {
    const tokens = this.loadTokens();
    return Object.values(tokens).map(token => ({
      realmId: token.realmId,
      companyName: token.companyName
    }));
  }
  
  hasTokens(): boolean {
    const tokens = this.loadTokens();
    return Object.keys(tokens).length > 0;
  }
  
  close(): void {
    // No-op for JSON storage
  }
}

// Re-export TokenStorage to use JSON implementation
export class TokenStorage {
  private db: TokenDatabase | null = null;
  
  private getDatabase(): TokenDatabase {
    if (!this.db) {
      const config = getConfig();
      this.db = new TokenDatabase(config.storageDir);
    }
    return this.db;
  }
  
  async saveRefreshToken(tokenData: TokenData): Promise<void> {
    if (!tokenData.realmId) {
      throw new Error('realmId is required for token storage');
    }
    
    const db = this.getDatabase();
    db.saveToken(tokenData);
    
    console.error(`TokenStorage: Saved company "${tokenData.companyName}" (${tokenData.realmId})`);
  }
  
  async loadRefreshToken(companyNameOrRealmId?: string): Promise<TokenData | null> {
    const db = this.getDatabase();
    
    if (companyNameOrRealmId) {
      // Try to load by realm ID first (more specific)
      let token = db.loadToken(companyNameOrRealmId);
      
      // If not found, try by company name
      if (!token) {
        token = db.loadTokenByCompanyName(companyNameOrRealmId);
      }
      
      return token;
    } else {
      // No specific company requested, return first available
      const companies = db.listCompanies();
      if (companies.length > 0) {
        return db.loadToken(companies[0].realmId);
      }
    }
    
    return null;
  }
  
  async clearTokens(companyNameOrRealmId?: string): Promise<void> {
    const db = this.getDatabase();
    db.clearTokens(companyNameOrRealmId);
  }
  
  async listCompanies(): Promise<string[]> {
    const db = this.getDatabase();
    const companies = db.listCompanies();
    return companies.map(c => c.companyName);
  }
  
  async getCompanyInfo(): Promise<CompanyInfo[]> {
    const db = this.getDatabase();
    return db.listCompanies();
  }
  
  async hasTokens(): Promise<boolean> {
    const db = this.getDatabase();
    return db.hasTokens();
  }
  
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
  
  hasOAuthCredentials(): boolean {
    const isDXT = process.env.DXT_ENVIRONMENT === 'true';
    
    if (isDXT) {
      return !!(process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET);
    }
    
    const hasQB = !!(process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET);
    const hasIntuit = !!(process.env.INTUIT_CLIENT_ID && process.env.INTUIT_CLIENT_SECRET);
    const hasQBProd = !!(process.env.QB_CLIENT_ID_PRODUCTION && process.env.QB_CLIENT_SECRET_PRODUCTION);
    const hasIntuitProd = !!(process.env.INTUIT_CLIENT_ID_PRODUCTION && process.env.INTUIT_CLIENT_SECRET_PRODUCTION);
    return hasQB || hasIntuit || hasQBProd || hasIntuitProd;
  }
  
  getOAuthCredentials() {
    const isProduction = process.env.QB_PRODUCTION === 'true' || process.env.QUICKBOOKS_PRODUCTION === 'true';
    const isDXT = process.env.DXT_ENVIRONMENT === 'true';
    
    let clientId: string = '';
    let clientSecret: string = '';
    
    if (isDXT) {
      clientId = process.env.QB_CLIENT_ID || '';
      clientSecret = process.env.QB_CLIENT_SECRET || '';
    } else if (isProduction) {
      clientId = process.env.QB_CLIENT_ID_PRODUCTION || 
                 process.env.INTUIT_CLIENT_ID_PRODUCTION ||
                 process.env.QB_CLIENT_ID || 
                 process.env.INTUIT_CLIENT_ID || '';
      clientSecret = process.env.QB_CLIENT_SECRET_PRODUCTION || 
                     process.env.INTUIT_CLIENT_SECRET_PRODUCTION ||
                     process.env.QB_CLIENT_SECRET || 
                     process.env.INTUIT_CLIENT_SECRET || '';
    } else {
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