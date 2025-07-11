// Windows OAuth Debug Script
import net from 'net';
import OAuthClient from 'intuit-oauth';

console.log('=== Windows OAuth Debug Script ===\n');

// Check if ports are available
console.log('1. Checking OAuth port availability:');
const checkPort = (port) => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.on('error', () => {
      console.log(`   Port ${port}: OCCUPIED`);
      resolve(false);
    });
    server.on('listening', () => {
      server.close();
      console.log(`   Port ${port}: AVAILABLE`);
      resolve(true);
    });
    server.listen(port);
  });
};

// Check OAuth port range
async function checkPorts() {
  for (let port = 9741; port <= 9758; port++) {
    await checkPort(port);
  }
}

await checkPorts();

// Check OAuth client
console.log('\n2. Checking OAuth Client:');
console.log('   OAuthClient type:', typeof OAuthClient);
console.log('   OAuthClient.scopes:', OAuthClient.scopes);
console.log('   Accounting scope:', OAuthClient.scopes?.Accounting);

// Test OAuth URL generation
console.log('\n3. Testing OAuth URL generation:');
try {
  const client = new OAuthClient({
    clientId: 'test-client',
    clientSecret: 'test-secret',
    environment: 'production',
    redirectUri: 'https://127-0-0-1.sslip.io:9741/cb'
  });

  const url = client.authorizeUri({
    scope: ['com.intuit.quickbooks.accounting'],
    state: 'test-state'
  });
  
  console.log('   URL generated successfully');
  console.log('   URL:', url);
} catch (error) {
  console.log('   ERROR:', error.message);
}

// Check environment
console.log('\n4. Environment variables:');
console.log('   QB_PRODUCTION:', process.env.QB_PRODUCTION);
console.log('   QB_CLIENT_ID:', process.env.QB_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('   QB_CLIENT_SECRET:', process.env.QB_CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('   QB_REDIRECT_URI:', process.env.QB_REDIRECT_URI || 'NOT SET');

console.log('\n=== End Debug ===');