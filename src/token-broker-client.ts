import { z } from 'zod';

// Schemas for API responses
const CompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  realmId: z.string(),
  createdAt: z.string(),
  lastAccessed: z.string().optional()
});

const QuickBooksTokenSchema = z.object({
  access_token: z.string(),
  realm_id: z.string(),
  company_name: z.string(),
  expires_at: z.number(),
  refresh_token: z.string().optional()
});

const TokenListResponseSchema = z.array(CompanySchema);

export type Company = z.infer<typeof CompanySchema>;
export type QuickBooksToken = z.infer<typeof QuickBooksTokenSchema>;

export interface TokenBrokerConfig {
  apiUrl: string;
  apiToken: string;
  timeout?: number;
}

export class TokenBrokerClient {
  private config: TokenBrokerConfig;
  
  constructor(config: TokenBrokerConfig) {
    this.config = {
      timeout: 30000, // 30 second default timeout
      ...config
    };
  }
  
  /**
   * List all companies connected to the broker
   */
  async listCompanies(): Promise<Company[]> {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/tokens`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(this.config.timeout!)
      });
      
      if (!response.ok) {
        throw new Error(`Token broker returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return TokenListResponseSchema.parse(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to list companies: ${error.message}`);
      }
      throw error;
    }
  }
  
  /**
   * Get a fresh access token for a specific company
   */
  async getAccessToken(companyIdOrName: string): Promise<QuickBooksToken> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/api/tokens/${encodeURIComponent(companyIdOrName)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(this.config.timeout!)
        }
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Company "${companyIdOrName}" not found`);
        }
        throw new Error(`Token broker returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return QuickBooksTokenSchema.parse(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get access token: ${error.message}`);
      }
      throw error;
    }
  }
  
  /**
   * Health check for the token broker
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.apiUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // Quick 5s timeout for health checks
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * Detect company from context in user prompt
   * This is a simple implementation - can be enhanced with NLP
   */
  detectCompanyFromContext(prompt: string, companies: Company[]): Company | null {
    const lowerPrompt = prompt.toLowerCase();
    
    // Look for exact company name matches (case-insensitive)
    for (const company of companies) {
      if (lowerPrompt.includes(company.name.toLowerCase())) {
        return company;
      }
    }
    
    // Look for company ID matches
    for (const company of companies) {
      if (prompt.includes(company.id) || prompt.includes(company.realmId)) {
        return company;
      }
    }
    
    // Look for common patterns like "for Acme" or "Acme's invoices"
    const patterns = [
      /for\s+(\w+(?:\s+\w+)*?)(?:\s|'s|$)/i,
      /(\w+(?:\s+\w+)*?)'s\s+/i,
      /company\s+(\w+(?:\s+\w+)*?)(?:\s|$)/i,
      /client\s+(\w+(?:\s+\w+)*?)(?:\s|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      if (match) {
        const possibleName = match[1].toLowerCase();
        const company = companies.find(c => 
          c.name.toLowerCase().includes(possibleName) ||
          possibleName.includes(c.name.toLowerCase())
        );
        if (company) return company;
      }
    }
    
    return null;
  }
}