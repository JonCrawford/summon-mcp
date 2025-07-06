import QuickBooks from 'node-quickbooks';
import { CacheManager } from './cache-manager.js';
import { TokenBrokerClient, Company } from './token-broker-client.js';

export interface QuickBooksBrokerConfig {
  brokerApiUrl: string;
  brokerApiToken: string;
  defaultCompany?: string;
  cacheTTL?: number;
  cacheDir?: string;
}

export class QuickBooksBroker {
  private cacheManager: CacheManager;
  private brokerClient: TokenBrokerClient;
  private config: QuickBooksBrokerConfig;
  
  constructor(config: QuickBooksBrokerConfig) {
    this.config = config;
    
    // Initialize broker client
    this.brokerClient = new TokenBrokerClient({
      apiUrl: config.brokerApiUrl,
      apiToken: config.brokerApiToken
    });
    
    // Initialize cache manager
    this.cacheManager = new CacheManager(this.brokerClient, {
      companyCacheTTL: config.cacheTTL,
      cacheDir: config.cacheDir
    });
  }
  
  /**
   * Get cache manager instance for cache tools
   */
  getCacheManager(): CacheManager {
    return this.cacheManager;
  }
  
  /**
   * Get broker client instance
   */
  getBrokerClient(): TokenBrokerClient {
    return this.brokerClient;
  }
  
  /**
   * List all available companies
   */
  async listCompanies(): Promise<Company[]> {
    return this.cacheManager.getCompanies();
  }
  
  /**
   * Get QuickBooks client for a specific company
   */
  async getQBOClient(companyIdOrName?: string): Promise<QuickBooks> {
    let targetCompany: string;
    
    if (!companyIdOrName) {
      // Use default company if configured
      if (this.config.defaultCompany) {
        targetCompany = this.config.defaultCompany;
      } else {
        // If no default, get companies and use first one if only one exists
        const companies = await this.cacheManager.getCompanies();
        if (companies.length === 0) {
          throw new Error('No QuickBooks companies connected. Please connect a company via the token broker.');
        } else if (companies.length === 1) {
          targetCompany = companies[0].id;
        } else {
          throw new Error('Multiple companies available. Please specify which company to use.');
        }
      }
    } else {
      targetCompany = companyIdOrName;
    }
    
    try {
      // Get token from cache/broker
      const token = await this.cacheManager.getAccessToken(targetCompany);
      
      // Determine environment from broker URL
      // This is a simple heuristic - could be made more sophisticated
      const isProduction = !this.config.brokerApiUrl.includes('sandbox');
      
      // Create QuickBooks client
      // Note: In the new architecture, we get client ID/secret from broker response
      // For now, using dummy values as they're not needed for API calls with bearer token
      const qbo = new QuickBooks(
        'broker_client', // Client ID not used with OAuth 2.0 bearer tokens
        'broker_secret', // Client secret not used with OAuth 2.0 bearer tokens
        token.access_token,
        false, // No token secret for OAuth 2.0
        token.realm_id,
        !isProduction, // Use sandbox = true when NOT in production
        false, // Disable debug - must be false for MCP stdio transport
        null, // Minor version
        '2.0', // OAuth version
        token.refresh_token // Include refresh token if available
      );
      
      return qbo;
    } catch (error) {
      if (error instanceof Error) {
        // Enhance error messages for common cases
        if (error.message.includes('not found')) {
          const companies = await this.cacheManager.getCompanies();
          const companyList = companies.map(c => `"${c.name}" (${c.id})`).join(', ');
          throw new Error(
            `Company "${targetCompany}" not found. Available companies: ${companyList || 'none'}`
          );
        }
        throw error;
      }
      throw new Error(`Failed to get QuickBooks client: ${error}`);
    }
  }
  
  /**
   * Detect company from user prompt context
   */
  async detectCompanyFromPrompt(prompt: string): Promise<Company | null> {
    const companies = await this.cacheManager.getCompanies();
    return this.brokerClient.detectCompanyFromContext(prompt, companies);
  }
  
  /**
   * Get a specific company by ID, name, or realm ID
   */
  async getCompany(idOrName: string): Promise<Company | null> {
    // Try cache first
    const cached = this.cacheManager.getCachedCompany(idOrName);
    if (cached) return cached;
    
    // Fetch fresh data if not in cache
    const companies = await this.cacheManager.getCompanies();
    return companies.find(c => 
      c.id === idOrName || 
      c.name === idOrName || 
      c.realmId === idOrName
    ) || null;
  }
  
  /**
   * Check if broker is healthy
   */
  async checkBrokerHealth(): Promise<boolean> {
    return this.cacheManager.checkBrokerHealth();
  }
}