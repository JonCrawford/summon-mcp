#!/usr/bin/env node

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupDemoTokens() {
  console.log('\n🚀 QuickBooks MCP Demo Setup\n');
  console.log('This wizard will help you set up the mock token broker with your actual tokens.\n');

  const companies = [];
  let addMore = true;
  let companyCount = 0;

  while (addMore && companyCount < 5) {
    companyCount++;
    console.log(`\n📋 Company ${companyCount}:`);
    
    const name = await question('Company Name (e.g., "Acme Corporation"): ');
    const realmId = await question('Realm ID (from QuickBooks): ');
    const refreshToken = await question('Refresh Token (from tokens.json): ');
    
    companies.push({
      id: `company-${companyCount}`,
      name: name.trim(),
      realmId: realmId.trim(),
      refreshToken: refreshToken.trim()
    });

    if (companyCount < 5) {
      const more = await question('\nAdd another company? (y/n): ');
      addMore = more.toLowerCase() === 'y';
    }
  }

  // Generate the mock broker code
  const mockBrokerPath = path.join(__dirname, '..', 'src', 'mock-token-broker.ts');
  let mockBrokerContent = await fs.promises.readFile(mockBrokerPath, 'utf-8');

  // Generate company data
  const companyData = companies.map(c => `  {
    id: '${c.id}',
    name: '${c.name}',
    realmId: '${c.realmId}',
    createdAt: '2024-01-01T00:00:00Z',
    lastAccessed: new Date().toISOString()
  }`).join(',\n');

  // Generate token data
  const tokenData = companies.map(c => `  '${c.id}': {
    access_token: 'eyJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiZGlyIn0..will-be-refreshed',
    refresh_token: '${c.refreshToken}',
    realm_id: '${c.realmId}',
    company_name: '${c.name}',
    expires_at: Date.now() + 3600000
  }`).join(',\n');

  // Replace the mock data
  mockBrokerContent = mockBrokerContent.replace(
    /const MOCK_COMPANIES: Company\[\] = \[[\s\S]*?\];/,
    `const MOCK_COMPANIES: Company[] = [\n${companyData}\n];`
  );

  mockBrokerContent = mockBrokerContent.replace(
    /const MOCK_TOKENS: Record<string, QuickBooksToken> = \{[\s\S]*?\};/,
    `const MOCK_TOKENS: Record<string, QuickBooksToken> = {\n${tokenData}\n};`
  );

  await fs.promises.writeFile(mockBrokerPath, mockBrokerContent);

  console.log('\n✅ Mock token broker updated successfully!\n');
  console.log('Next steps:');
  console.log('1. Start the mock broker: npm run start:mock-broker');
  console.log('2. Configure Claude Desktop with:');
  console.log('   brokerApiUrl: "http://localhost:3000"');
  console.log('   brokerApiToken: "demo-token-123"');
  console.log('\n🎉 Ready for your demo!\n');

  rl.close();
}

setupDemoTokens().catch(console.error);