#!/usr/bin/env node

/**
 * Manual OAuth token exchange script
 * Use this when the OAuth callback fails due to SSL or other issues
 */

import { TokenManager } from './dist/token-manager.js';
import dotenv from 'dotenv';

dotenv.config();

async function exchangeCode() {
  const code = process.argv[2];
  const realmId = process.argv[3];
  
  if (!code || !realmId) {
    console.error('Usage: node manual-oauth.js <auth-code> <realm-id>');
    console.error('Example: node manual-oauth.js XAB11751852187aqFfCCCWIqmBcsoj1blMSp29I9HMhGIJTIkw 9341454914780836');
    process.exit(1);
  }
  
  try {
    console.log('Exchanging authorization code for tokens...');
    const tokenManager = new TokenManager();
    
    // Exchange the code
    await tokenManager.exchangeCodeForTokens(code, realmId);
    
    console.log('✅ Successfully saved tokens!');
    console.log(`Connected to QuickBooks company with realm ID: ${realmId}`);
    
    // Verify we can get an access token
    const accessToken = await tokenManager.getAccessToken();
    console.log('✅ Verified access token is available');
    
  } catch (error) {
    console.error('❌ Failed to exchange code:', error.message);
    console.error('The authorization code may have expired. They are only valid for a few minutes.');
    console.error('Please run the authenticate tool again to get a fresh code.');
  }
}

exchangeCode();