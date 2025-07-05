declare module 'node-quickbooks' {
  export default class QuickBooks {
    constructor(
      clientId: string,
      clientSecret: string,
      accessToken: string,
      tokenSecret: boolean,
      realmId: string,
      useSandbox: boolean,
      debug: boolean,
      minorVersion: number | null,
      oauthVersion: string,
      refreshToken?: string
    );
    
    // Add method signatures as needed
    [key: string]: any;
  }
}