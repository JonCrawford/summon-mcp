import { config } from 'dotenv';
import OAuthClient from 'intuit-oauth';
import fs from 'fs/promises';
import path from 'path';
import { getConfig, isConfigError } from './config.js';

// Load environment variables
config();

async function refreshTokens() {
  try {
    // Get configuration
    const configResult = getConfig();
    if (isConfigError(configResult)) {
      console.error('Configuration error:', configResult.message);
      throw new Error(configResult.message);
    }
    
    // Initialize OAuth Client
    const oauthClient = new OAuthClient({
      clientId: configResult.clientId,
      clientSecret: configResult.clientSecret,
      environment: configResult.environment,
      redirectUri: 'http://localhost:8080/callback',
      logging: false
    });

    // Use the refresh token from .env.old
    const refreshToken = 'RT1-239-H0-1760333674ch3rr6yfj2hhf0ujb4jk';
    const realmId = '4620816365222101600';

    console.log('Attempting to refresh tokens...');
    
    // Set the refresh token on the client
    oauthClient.setToken({
      refresh_token: refreshToken,
      access_token: '' // Dummy value, will be replaced
    });

    // Refresh the tokens
    const authResponse = await oauthClient.refreshUsingToken(refreshToken);
    
    console.log('Token refresh successful!');

    // Get the token data from the OAuth client after refresh
    const token = oauthClient.getToken();
    console.log('Token object has properties:', Object.keys(token));
    
    // Prepare token data to save
    const tokenData = {
      access_token: token.access_token || authResponse.access_token,
      refresh_token: token.refresh_token || authResponse.refresh_token || refreshToken,
      expires_at: Date.now() + ((token.expires_in || authResponse.expires_in || 3600) * 1000),
      x_refresh_token_expires_at: Date.now() + ((token.x_refresh_token_expires_in || authResponse.x_refresh_token_expires_in || 8726400) * 1000),
      realm_id: realmId,
      created_at: Date.now()
    };
    
    console.log('Token data to save:', tokenData);

    // Save tokens to file
    const tokensPath = path.join(process.cwd(), configResult.tokenFilePath);
    await fs.writeFile(tokensPath, JSON.stringify(tokenData, null, 2));
    
    console.log(`Tokens saved to ${configResult.tokenFilePath}`);
    console.log('Access token expires in:', authResponse.expires_in, 'seconds');
    console.log('Refresh token expires in:', authResponse.x_refresh_token_expires_in, 'seconds');
    
    return tokenData;
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    throw error;
  }
}

// Run the refresh
refreshTokens()
  .then(() => {
    console.log('Token refresh completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Token refresh failed:', error);
    process.exit(1);
  });