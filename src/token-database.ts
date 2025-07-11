/**
 * Token Database using sql.js (pure JavaScript SQLite)
 * 
 * This implementation uses sql.js to avoid native module issues in DXT
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define token data structure  
export interface TokenData {
  realmId: string;
  companyName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Company info for LLM context
export interface CompanyInfo {
  realmId: string;
  companyName: string;
}

// Internal database record
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

let sqlJsInstance: any = null;

async function getSqlJs() {
  if (!sqlJsInstance) {
    sqlJsInstance = await initSqlJs({
      // Dynamic WASM file location that works in both local and DXT environments
      locateFile: file => {
        const pathsToTry = [];

        // In DXT environment, try to resolve from the current directory
        if (process.env.DXT_ENVIRONMENT === 'true') {
          // Try the DXT bundled location relative to __dirname
          pathsToTry.push(path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file));
          // Try relative to current working directory
          pathsToTry.push(path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file));
          // Try direct in __dirname (in case sql.js files are bundled)
          pathsToTry.push(path.join(__dirname, file));
        }
        
        // Standard local development path
        pathsToTry.push(path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file));
        // Fallback to the original path for compatibility
        pathsToTry.push(`node_modules/sql.js/dist/${file}`);

        for (const testPath of pathsToTry) {
          console.error(`[sql.js] Trying path: ${testPath}`);
          if (fs.existsSync(testPath)) {
            console.error(`[sql.js] Found file at: ${testPath}`);
            return testPath;
          }
        }

        console.error(`[sql.js] File not found, falling back to: ${pathsToTry[pathsToTry.length - 1]}`);
        return pathsToTry[pathsToTry.length - 1];
      }
    });
  }
  return sqlJsInstance;
}

export class TokenDatabase {
  private db: any; // sql.js Database instance
  private dbPath: string;
  private environment: string;
  private isInitialized: boolean = false;
  
  constructor(storageDir: string) {
    // Always create .summon subdirectory
    const summonDir = path.join(storageDir, '.summon');
    
    // Ensure storage directory exists
    if (!fs.existsSync(summonDir)) {
      fs.mkdirSync(summonDir, { recursive: true });
    }
    
    this.dbPath = path.join(summonDir, 'tokens.db');
    
    // Debug: Log the actual QB_PRODUCTION value
    console.error('[TokenDatabase] QB_PRODUCTION env var:', process.env.QB_PRODUCTION);
    console.error('[TokenDatabase] typeof QB_PRODUCTION:', typeof process.env.QB_PRODUCTION);
    
    // Check for 'true' string (environment variables are always strings)
    const isProduction = process.env.QB_PRODUCTION === 'true' || 
                        process.env.QUICKBOOKS_PRODUCTION === 'true'; // legacy support
    
    this.environment = isProduction ? 'production' : 'sandbox';
    console.error('[TokenDatabase] Environment set to:', this.environment);
  }
  
  /**
   * Initialize the database (async operation for sql.js)
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    const SQL = await getSqlJs();
    
    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const data = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(data);
    } else {
      this.db = new SQL.Database();
    }
    
    // Create tokens table if not exists
    this.db.run(`
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
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_company_name 
      ON tokens(company_name, environment);
    `);
    
    this.isInitialized = true;
    this.saveToFile();
  }
  
  /**
   * Save database to file
   */
  private saveToFile(): void {
    if (!this.db) return;
    
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }
  
  /**
   * Save or update token
   */
  async saveToken(tokenData: TokenData): Promise<void> {
    await this.init();
    
    console.error(`[TokenDatabase] saveToken: Saving token for realm ${tokenData.realmId}, company "${tokenData.companyName}", environment: ${this.environment}`);
    
    const now = Math.floor(Date.now() / 1000);
    
    this.db.run(`
      INSERT OR REPLACE INTO tokens (
        realm_id, company_name, access_token, refresh_token, 
        expires_at, environment, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 
        COALESCE((SELECT created_at FROM tokens WHERE realm_id = ?), ?),
        ?
      )
    `, [
      tokenData.realmId,
      tokenData.companyName,
      tokenData.accessToken,
      tokenData.refreshToken,
      tokenData.expiresAt,
      this.environment,
      tokenData.realmId, // for the COALESCE subquery
      now, // for created_at default
      now  // for updated_at
    ]);
    
    this.saveToFile();
  }
  
  /**
   * Load token by realm ID
   */
  async loadToken(realmId: string): Promise<TokenData | null> {
    await this.init();
    
    const stmt = this.db.prepare(`
      SELECT * FROM tokens 
      WHERE realm_id = ? AND environment = ?
    `);
    
    stmt.bind([realmId, this.environment]);
    
    if (stmt.step()) {
      const record = stmt.getAsObject() as TokenRecord;
      stmt.free();
      return this.recordToTokenData(record);
    }
    
    stmt.free();
    return null;
  }
  
  /**
   * Load token by company name (exact match)
   * The LLM will use qb_list_companies to get the exact names
   */
  async loadTokenByCompanyName(companyName: string): Promise<TokenData | null> {
    await this.init();
    
    const stmt = this.db.prepare(`
      SELECT * FROM tokens 
      WHERE company_name = ? AND environment = ?
    `);
    
    stmt.bind([companyName, this.environment]);
    
    if (stmt.step()) {
      const record = stmt.getAsObject() as TokenRecord;
      stmt.free();
      return this.recordToTokenData(record);
    }
    
    stmt.free();
    return null;
  }
  
  /**
   * List all companies (for LLM context)
   */
  async listCompanies(): Promise<CompanyInfo[]> {
    await this.init();
    
    console.error(`[TokenDatabase] listCompanies: Querying for environment: ${this.environment}`);
    
    const stmt = this.db.prepare(`
      SELECT realm_id, company_name 
      FROM tokens 
      WHERE environment = ?
      ORDER BY company_name
    `);
    
    stmt.bind([this.environment]);
    
    const companies: CompanyInfo[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as {realm_id: string, company_name: string};
      companies.push({
        realmId: row.realm_id,
        companyName: row.company_name
      });
    }
    
    console.error(`[TokenDatabase] listCompanies: Found ${companies.length} companies`);
    
    // Debug: Show all tokens in database regardless of environment
    if (companies.length === 0) {
      const debugStmt = this.db.prepare(`SELECT realm_id, company_name, environment FROM tokens`);
      const allTokens: any[] = [];
      while (debugStmt.step()) {
        allTokens.push(debugStmt.getAsObject());
      }
      debugStmt.free();
      console.error('[TokenDatabase] Debug - All tokens in database:', allTokens);
    }
    
    stmt.free();
    return companies;
  }
  
  /**
   * Delete token for a company
   */
  async deleteToken(realmId: string): Promise<void> {
    await this.init();
    
    this.db.run(`
      DELETE FROM tokens 
      WHERE realm_id = ? AND environment = ?
    `, [realmId, this.environment]);
    
    this.saveToFile();
  }
  
  /**
   * Check if we have any tokens
   */
  async hasTokens(): Promise<boolean> {
    await this.init();
    
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM tokens WHERE environment = ?
    `);
    
    stmt.bind([this.environment]);
    
    let count = 0;
    if (stmt.step()) {
      const row = stmt.getAsObject() as {count: number};
      count = row.count;
    }
    
    stmt.free();
    return count > 0;
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
      expiresAt: record.expires_at
    };
  }
  
  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }
}