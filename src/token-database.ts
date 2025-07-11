/**
 * Token Database using better-sqlite3
 * 
 * Manages SQLite storage of OAuth tokens with proper multi-process support
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

export interface TokenData {
  realmId: string;
  companyName: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface TokenRecord {
  realm_id: string;
  company_name: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  environment: string;
  created_at: number;
  updated_at: number;
}

export interface CompanyInfo {
  realmId: string;
  companyName: string;
}

export class TokenDatabase {
  private db: Database.Database;
  private environment: string;
  
  constructor(storageDir: string) {
    // Always create .summon subdirectory
    const summonDir = path.join(storageDir, '.summon');
    
    // Ensure storage directory exists
    if (!fs.existsSync(summonDir)) {
      fs.mkdirSync(summonDir, { recursive: true });
    }
    
    const dbPath = path.join(summonDir, 'tokens.db');
    
    // Debug: Log the actual QB_PRODUCTION value
    console.error('[TokenDatabase] QB_PRODUCTION env var:', process.env.QB_PRODUCTION);
    console.error('[TokenDatabase] typeof QB_PRODUCTION:', typeof process.env.QB_PRODUCTION);
    
    // Check for 'true' string (environment variables are always strings)
    const isProduction = process.env.QB_PRODUCTION === 'true' || 
                        process.env.QUICKBOOKS_PRODUCTION === 'true'; // legacy support
    
    this.environment = isProduction ? 'production' : 'sandbox';
    console.error('[TokenDatabase] Environment set to:', this.environment);
    
    // Open database (creates if not exists)
    this.db = new Database(dbPath);
    
    // Enable Write-Ahead Logging for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Create tokens table if not exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tokens (
        realm_id      TEXT PRIMARY KEY,
        company_name  TEXT NOT NULL,
        access_token  TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at    INTEGER NOT NULL,
        environment   TEXT NOT NULL CHECK(environment IN ('production', 'sandbox')),
        created_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
    `);
    
    // Create index on company name for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_company_name 
      ON tokens(company_name, environment);
    `);
    
    console.error('[TokenDatabase] Database initialized successfully');
  }
  
  /**
   * Save or update token
   */
  saveToken(tokenData: TokenData): void {
    console.error(`[TokenDatabase] saveToken: Saving token for realm ${tokenData.realmId}, company "${tokenData.companyName}", environment: ${this.environment}`);
    
    const now = Math.floor(Date.now() / 1000);
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tokens (
        realm_id, company_name, access_token, refresh_token, 
        expires_at, environment, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 
        COALESCE((SELECT created_at FROM tokens WHERE realm_id = ?), ?),
        ?
      )
    `);
    
    stmt.run(
      tokenData.realmId,
      tokenData.companyName,
      tokenData.accessToken,
      tokenData.refreshToken,
      Math.floor(tokenData.expiresAt! / 1000), // Convert from milliseconds to seconds
      this.environment,
      tokenData.realmId, // for the COALESCE subquery
      now, // for created_at default
      now  // for updated_at
    );
  }
  
  /**
   * Load token by realm ID
   */
  loadToken(realmId: string): TokenData | null {
    const stmt = this.db.prepare(`
      SELECT * FROM tokens 
      WHERE realm_id = ? AND environment = ?
    `);
    
    const record = stmt.get(realmId, this.environment) as TokenRecord | undefined;
    return record ? this.recordToTokenData(record) : null;
  }
  
  /**
   * Load token by company name (exact match)
   * The LLM will use qb_list_companies to get the exact names
   */
  loadTokenByCompanyName(companyName: string): TokenData | null {
    const stmt = this.db.prepare(`
      SELECT * FROM tokens 
      WHERE company_name = ? AND environment = ?
    `);
    
    const record = stmt.get(companyName, this.environment) as TokenRecord | undefined;
    return record ? this.recordToTokenData(record) : null;
  }
  
  /**
   * List all companies (for LLM context)
   */
  listCompanies(): CompanyInfo[] {
    console.error(`[TokenDatabase] listCompanies: Querying for environment: ${this.environment}`);
    
    const stmt = this.db.prepare(`
      SELECT realm_id, company_name 
      FROM tokens 
      WHERE environment = ?
      ORDER BY company_name
    `);
    
    const rows = stmt.all(this.environment) as Array<{ realm_id: string; company_name: string }>;
    
    const companies = rows.map(row => ({
      realmId: row.realm_id,
      companyName: row.company_name
    }));
    
    console.error(`[TokenDatabase] listCompanies: Found ${companies.length} companies`);
    return companies;
  }
  
  /**
   * Clear all tokens for a company (by name or realm ID)
   */
  clearTokens(companyIdentifier?: string): void {
    if (companyIdentifier) {
      // Try both company name and realm ID
      const stmt = this.db.prepare(`
        DELETE FROM tokens 
        WHERE environment = ? AND (company_name = ? OR realm_id = ?)
      `);
      
      const result = stmt.run(this.environment, companyIdentifier, companyIdentifier);
      console.error(`[TokenDatabase] clearTokens: Deleted ${result.changes} tokens for identifier "${companyIdentifier}"`);
    } else {
      // Clear all tokens for this environment
      const stmt = this.db.prepare(`
        DELETE FROM tokens 
        WHERE environment = ?
      `);
      
      const result = stmt.run(this.environment);
      console.error(`[TokenDatabase] clearTokens: Deleted ${result.changes} tokens for environment ${this.environment}`);
    }
  }
  
  /**
   * Check if we have any tokens
   */
  hasTokens(): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM tokens WHERE environment = ?
    `);
    
    const result = stmt.get(this.environment) as { count: number };
    return result.count > 0;
  }
  
  /**
   * Convert database record to token data
   */
  private recordToTokenData(record: TokenRecord): TokenData {
    return {
      realmId: record.realm_id,
      companyName: record.company_name,
      accessToken: record.access_token,
      refreshToken: record.refresh_token,
      expiresAt: record.expires_at * 1000 // Convert from seconds to milliseconds
    };
  }
  
  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}