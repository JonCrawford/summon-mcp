import { createServer } from 'http';
import { Company, QuickBooksToken } from './token-broker-client.js';

// Mock data - replace these with your actual tokens and company info
const MOCK_COMPANIES: Company[] = [
  {
    id: 'company-1',
    name: 'Acme Corporation',
    realmId: '4620816365019612345', // Replace with actual realm ID
    createdAt: '2024-01-01T00:00:00Z',
    lastAccessed: new Date().toISOString()
  },
  {
    id: 'company-2',
    name: 'Widget Industries',
    realmId: '4620816365019612346', // Replace with actual realm ID
    createdAt: '2024-01-01T00:00:00Z',
    lastAccessed: new Date().toISOString()
  },
  {
    id: 'company-3',
    name: 'Tech Solutions LLC',
    realmId: '4620816365019612347', // Replace with actual realm ID
    createdAt: '2024-01-01T00:00:00Z',
    lastAccessed: new Date().toISOString()
  }
];

// Mock tokens - replace with your actual refresh tokens
const MOCK_TOKENS: Record<string, QuickBooksToken> = {
  'company-1': {
    access_token: 'eyJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiZGlyIn0..fake-token-1', // Will be refreshed
    refresh_token: 'AB11234567890refreshtoken1', // Replace with actual refresh token
    realm_id: '4620816365019612345',
    company_name: 'Acme Corporation',
    expires_at: Date.now() + 3600000 // 1 hour from now
  },
  'company-2': {
    access_token: 'eyJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiZGlyIn0..fake-token-2',
    refresh_token: 'AB11234567890refreshtoken2', // Replace with actual refresh token
    realm_id: '4620816365019612346',
    company_name: 'Widget Industries',
    expires_at: Date.now() + 3600000
  },
  'company-3': {
    access_token: 'eyJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiZGlyIn0..fake-token-3',
    refresh_token: 'AB11234567890refreshtoken3', // Replace with actual refresh token
    realm_id: '4620816365019612347',
    company_name: 'Tech Solutions LLC',
    expires_at: Date.now() + 3600000
  }
};

// Simple mock token broker server
export function startMockTokenBroker(port: number = 3000) {
  const server = createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Check authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Route handling
    if (req.url === '/api/tokens' && req.method === 'GET') {
      // List companies
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(MOCK_COMPANIES));
    } else if (req.url?.startsWith('/api/tokens/') && req.method === 'GET') {
      // Get token for specific company
      const companyId = req.url.split('/').pop();
      const company = MOCK_COMPANIES.find(c => 
        c.id === companyId || 
        c.name.toLowerCase() === companyId?.toLowerCase() ||
        c.realmId === companyId
      );
      
      if (!company) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Company not found' }));
        return;
      }

      const token = MOCK_TOKENS[company.id];
      if (!token) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Token not found' }));
        return;
      }

      // Update last accessed
      company.lastAccessed = new Date().toISOString();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(token));
    } else if (req.url === '/health' && req.method === 'GET') {
      // Health check
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', mock: true }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(port, () => {
    console.log(`Mock Token Broker running on http://localhost:${port}`);
    console.log('\nAvailable companies:');
    MOCK_COMPANIES.forEach(company => {
      console.log(`  - ${company.name} (ID: ${company.id}, Realm: ${company.realmId})`);
    });
    console.log('\nEndpoints:');
    console.log('  GET /api/tokens - List all companies');
    console.log('  GET /api/tokens/{company} - Get token for company');
    console.log('  GET /health - Health check');
    console.log('\nNote: Replace the mock tokens with your actual refresh tokens!');
  });

  return server;
}

// Run if called directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  startMockTokenBroker(port);
}