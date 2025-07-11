/**
 * Demonstration that tokens are immediately visible without restart
 * This test simulates the exact issue: OAuth saves tokens, then subsequent
 * operations can see them WITHOUT restarting the server
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenDatabase } from '../src/token-database.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Token Visibility Without Restart', () => {
  const testDir = path.join(process.cwd(), 'test-token-visibility');
  
  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('demonstrates the fix: tokens visible immediately after OAuth', () => {
    console.log('\n=== SIMULATING MCP SERVER STARTUP ===');
    // This simulates the MCP server starting up
    const serverDb = new TokenDatabase(testDir);
    
    // Check initial state - no companies
    console.log('Initial check: No companies connected');
    let companies = serverDb.listCompanies();
    expect(companies).toHaveLength(0);
    
    console.log('\n=== SIMULATING OAUTH FLOW ===');
    // This simulates what happens during OAuth callback
    // In the old sql.js version, this would write to disk but
    // the serverDb instance wouldn't see it
    const oauthDb = new TokenDatabase(testDir);
    oauthDb.saveToken({
      realmId: 'oauth-realm-123',
      companyName: 'My QuickBooks Company',
      accessToken: 'access-abc',
      refreshToken: 'refresh-xyz',
      expiresAt: Date.now() + 3600000
    });
    console.log('OAuth: Saved tokens for "My QuickBooks Company"');
    oauthDb.close(); // OAuth handler closes
    
    console.log('\n=== CHECKING FROM ORIGINAL SERVER INSTANCE ===');
    // NOW THE KEY TEST: Can the original server instance see the tokens?
    // With sql.js this would return 0 companies (the bug!)
    // With better-sqlite3 it returns 1 company (fixed!)
    companies = serverDb.listCompanies();
    console.log(`Server sees ${companies.length} companies`);
    expect(companies).toHaveLength(1);
    expect(companies[0].companyName).toBe('My QuickBooks Company');
    
    // Also verify we can load the token
    const token = serverDb.loadToken('oauth-realm-123');
    expect(token).not.toBeNull();
    expect(token?.refreshToken).toBe('refresh-xyz');
    
    console.log('✅ SUCCESS: Tokens are immediately visible without restart!');
    console.log('   The server instance sees OAuth tokens without restarting');
    
    serverDb.close();
  });

  it('demonstrates multiple OAuth flows work without restart', () => {
    console.log('\n=== DEMONSTRATING MULTIPLE COMPANIES ===');
    
    // Long-running server instance
    const serverDb = new TokenDatabase(testDir);
    expect(serverDb.listCompanies()).toHaveLength(0);
    
    // First OAuth flow
    console.log('OAuth Flow 1: Adding "Company A"');
    const oauth1 = new TokenDatabase(testDir);
    oauth1.saveToken({
      realmId: 'realm-a',
      companyName: 'Company A',
      accessToken: 'access-a',
      refreshToken: 'refresh-a',
      expiresAt: Date.now() + 3600000
    });
    oauth1.close();
    
    // Server immediately sees it
    let companies = serverDb.listCompanies();
    console.log(`Server now sees ${companies.length} company`);
    expect(companies).toHaveLength(1);
    
    // Second OAuth flow
    console.log('\nOAuth Flow 2: Adding "Company B"');
    const oauth2 = new TokenDatabase(testDir);
    oauth2.saveToken({
      realmId: 'realm-b',
      companyName: 'Company B',
      accessToken: 'access-b',
      refreshToken: 'refresh-b',
      expiresAt: Date.now() + 3600000
    });
    oauth2.close();
    
    // Server immediately sees both
    companies = serverDb.listCompanies();
    console.log(`Server now sees ${companies.length} companies`);
    expect(companies).toHaveLength(2);
    
    // Third OAuth flow
    console.log('\nOAuth Flow 3: Adding "Company C"');
    const oauth3 = new TokenDatabase(testDir);
    oauth3.saveToken({
      realmId: 'realm-c',
      companyName: 'Company C',
      accessToken: 'access-c',
      refreshToken: 'refresh-c',
      expiresAt: Date.now() + 3600000
    });
    oauth3.close();
    
    // Server sees all three
    companies = serverDb.listCompanies();
    console.log(`Server now sees ${companies.length} companies`);
    expect(companies).toHaveLength(3);
    
    const companyNames = companies.map(c => c.companyName).sort();
    expect(companyNames).toEqual(['Company A', 'Company B', 'Company C']);
    
    console.log('\n✅ All companies visible without ANY server restarts!');
    serverDb.close();
  });

  it('shows the old sql.js problem vs better-sqlite3 solution', () => {
    console.log('\n=== COMPARISON: sql.js vs better-sqlite3 ===');
    console.log('\nOLD BEHAVIOR (sql.js):');
    console.log('1. Server starts → loads database into memory');
    console.log('2. OAuth saves tokens → writes to disk');
    console.log('3. Server checks companies → sees stale memory (0 companies)');
    console.log('4. User must restart server → reloads from disk (1 company)');
    
    console.log('\nNEW BEHAVIOR (better-sqlite3):');
    console.log('1. Server starts → opens database file');
    console.log('2. OAuth saves tokens → writes to database file');
    console.log('3. Server checks companies → reads from file (1 company)');
    console.log('4. No restart needed! ✅');
    
    // Demonstrate the fix
    const db = new TokenDatabase(testDir);
    expect(db.listCompanies()).toHaveLength(0);
    
    // Save from another instance (simulating OAuth)
    const oauthDb = new TokenDatabase(testDir);
    oauthDb.saveToken({
      realmId: 'demo-realm',
      companyName: 'Demo Company',
      accessToken: 'demo-access',
      refreshToken: 'demo-refresh',
      expiresAt: Date.now() + 3600000
    });
    oauthDb.close();
    
    // Original instance sees it immediately
    const companies = db.listCompanies();
    expect(companies).toHaveLength(1);
    console.log('\n✅ Confirmed: better-sqlite3 provides immediate visibility');
    
    db.close();
  });
});