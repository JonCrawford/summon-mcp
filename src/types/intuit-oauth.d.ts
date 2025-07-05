declare module 'intuit-oauth' {
  export interface OAuthClientConfig {
    clientId: string;
    clientSecret: string;
    environment: 'sandbox' | 'production';
    redirectUri: string;
    logging?: boolean;
  }
  
  export interface AuthorizeUriOptions {
    scope: string[];
    state?: string;
  }
  
  export interface TokenData {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
    token_type: string;
  }
  
  export default class OAuthClient {
    static scopes: {
      Accounting: string;
      Payment: string;
      OpenId: string;
    };
    
    constructor(config: OAuthClientConfig);
    
    authorizeUri(options: AuthorizeUriOptions): string;
    createToken(url: string): Promise<TokenData>;
    refreshUsingToken(refreshToken: string): Promise<TokenData>;
    setToken(token: { access_token: string; refresh_token: string }): void;
    getToken(): any;
  }
}