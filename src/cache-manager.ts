import fs from 'fs';
import path from 'path';
import { TokenBrokerClient, Company, QuickBooksToken } from './token-broker-client.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  etag?: string;
}

interface SerializedCache {
  companies?: CacheEntry<Company[]>;
  tokens?: { [key: string]: CacheEntry<QuickBooksToken> };
  brokerHealth?: CacheEntry<boolean>;
  version: string;
}

interface LocalCache {
  companies: CacheEntry<Company[]> | null;
  tokens: Map<string, CacheEntry<QuickBooksToken>>;
  brokerHealth: CacheEntry<boolean> | null;
}

export interface CacheManagerConfig {
  cacheDir?: string;
  companyCacheTTL?: number; // in hours
  brokerHealthTTL?: number; // in minutes
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  lastReset: Date;
}

export class CacheManager {
  private cache: LocalCache;
  private cacheDir: string;
  private cacheFile: string;
  private brokerClient: TokenBrokerClient;
  private config: Required<CacheManagerConfig>;
  private metrics: CacheMetrics;
  
  constructor(brokerClient: TokenBrokerClient, config: CacheManagerConfig = {}) {
    this.brokerClient = brokerClient;
    
    // Use provided cacheDir or empty string (no file caching)
    const effectiveCacheDir = config.cacheDir 
      ? path.join(config.cacheDir, 'quickbooks-mcp-cache')
      : '';
    
    this.config = {
      cacheDir: effectiveCacheDir,
      companyCacheTTL: config.companyCacheTTL || 24, // 24 hours default
      brokerHealthTTL: config.brokerHealthTTL || 5 // 5 minutes default
    };
    
    this.cacheDir = this.config.cacheDir;
    this.cacheFile = this.cacheDir ? path.join(this.cacheDir, 'cache.json') : '';
    
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      lastReset: new Date()
    };
    
    this.cache = {
      companies: null,
      tokens: new Map(),
      brokerHealth: null
    };
    
    this.initializeCache();
  }
  
  private initializeCache(): void {
    // Always start with empty cache to avoid synchronous filesystem operations
    this.initializeEmptyCache();
    
    // If no cache directory, use in-memory only
    if (!this.cacheDir) {
      console.error('CacheManager: No cache directory provided. Using in-memory cache only.');
      return;
    }
    
    // Defer cache loading to avoid blocking initialization
    // This prevents crashes in DXT environment
    setImmediate(() => {
      this.loadCacheAsync();
    });
  }
  
  private async loadCacheAsync(): Promise<void> {
    try {
      // Check and create directory asynchronously
      const dirExists = await fs.promises.access(this.cacheDir)
        .then(() => true)
        .catch(() => false);
      
      if (!dirExists) {
        await fs.promises.mkdir(this.cacheDir, { recursive: true });
      }
      
      // Load existing cache if available
      const fileExists = await fs.promises.access(this.cacheFile)
        .then(() => true)
        .catch(() => false);
        
      if (fileExists) {
        const data = await fs.promises.readFile(this.cacheFile, 'utf-8');
        const serialized: SerializedCache = JSON.parse(data);
        
        // Check cache version compatibility
        if (serialized.version === '1.0') {
          // Restore cache from serialized format
          this.cache.companies = serialized.companies || null;
          this.cache.brokerHealth = serialized.brokerHealth || null;
          
          // Rebuild Map from serialized tokens
          if (serialized.tokens) {
            Object.entries(serialized.tokens).forEach(([key, value]) => {
              this.cache.tokens.set(key, value);
            });
          }
          
          // Clean up expired entries
          this.cleanupExpiredEntries();
        }
      }
    } catch (error) {
      console.error('Failed to load cache asynchronously:', error);
    }
  }
  
  private initializeEmptyCache(): void {
    this.cache = {
      companies: null,
      tokens: new Map(),
      brokerHealth: null
    };
  }
  
  
  private saveCache(): void {
    // Skip if no cache file path
    if (!this.cacheFile) {
      return;
    }
    
    // Use async save to avoid blocking
    this.saveCacheAsync().catch(error => {
      console.error('Failed to save cache:', error);
      this.metrics.errors++;
    });
  }
  
  private async saveCacheAsync(): Promise<void> {
    try {
      // Convert Map to object for serialization
      const serialized: SerializedCache = {
        companies: this.cache.companies || undefined,
        tokens: Object.fromEntries(this.cache.tokens),
        brokerHealth: this.cache.brokerHealth || undefined,
        version: '1.0'
      };
      
      await fs.promises.writeFile(this.cacheFile, JSON.stringify(serialized, null, 2));
    } catch (error) {
      throw error;
    }
  }
  
  private isValid<T>(entry: CacheEntry<T> | null): boolean {
    if (!entry) return false;
    return entry.expiresAt > Date.now();
  }
  
  private cleanupExpiredEntries(): void {
    // Remove expired tokens
    const expiredTokens: string[] = [];
    this.cache.tokens.forEach((entry, key) => {
      if (!this.isValid(entry)) {
        expiredTokens.push(key);
      }
    });
    expiredTokens.forEach(key => this.cache.tokens.delete(key));
    
    // Clear expired companies
    if (this.cache.companies && !this.isValid(this.cache.companies)) {
      this.cache.companies = null;
    }
    
    // Clear expired broker health
    if (this.cache.brokerHealth && !this.isValid(this.cache.brokerHealth)) {
      this.cache.brokerHealth = null;
    }
  }
  
  async getCompanies(): Promise<Company[]> {
    // Check cache first
    if (this.cache.companies && this.isValid(this.cache.companies)) {
      this.metrics.hits++;
      return this.cache.companies.data;
    }
    
    this.metrics.misses++;
    
    try {
      // Fetch from broker
      const companies = await this.brokerClient.listCompanies();
      
      // Cache the result
      this.cache.companies = {
        data: companies,
        expiresAt: Date.now() + (this.config.companyCacheTTL * 60 * 60 * 1000)
      };
      
      this.saveCache();
      return companies;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }
  
  async getAccessToken(companyId: string): Promise<QuickBooksToken> {
    const cached = this.cache.tokens.get(companyId);
    
    // Use cached token if valid with 5-minute buffer
    if (cached && cached.expiresAt > Date.now() + (5 * 60 * 1000)) {
      this.metrics.hits++;
      return cached.data;
    }
    
    this.metrics.misses++;
    
    try {
      // Fetch fresh token from broker
      const token = await this.brokerClient.getAccessToken(companyId);
      
      // Cache the token
      this.cache.tokens.set(companyId, {
        data: token,
        expiresAt: token.expires_at
      });
      
      this.saveCache();
      return token;
    } catch (error) {
      this.metrics.errors++;
      
      // If broker fails, check if we have a recently expired token we can use
      if (cached && this.isRecentlyExpired(cached)) {
        return cached.data;
      }
      
      throw error;
    }
  }
  
  private isRecentlyExpired<T>(entry: CacheEntry<T>): boolean {
    // Consider tokens expired less than 1 hour ago as "recently expired"
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return entry.expiresAt > oneHourAgo;
  }
  
  async checkBrokerHealth(): Promise<boolean> {
    // Check cache first
    if (this.cache.brokerHealth && this.isValid(this.cache.brokerHealth)) {
      return this.cache.brokerHealth.data;
    }
    
    try {
      // Check broker health
      const isHealthy = await this.brokerClient.healthCheck();
      
      // Cache the result
      this.cache.brokerHealth = {
        data: isHealthy,
        expiresAt: Date.now() + (this.config.brokerHealthTTL * 60 * 1000)
      };
      
      this.saveCache();
      return isHealthy;
    } catch {
      // Cache negative result for shorter time
      this.cache.brokerHealth = {
        data: false,
        expiresAt: Date.now() + (60 * 1000) // 1 minute for failures
      };
      
      this.saveCache();
      return false;
    }
  }
  
  /**
   * Force refresh all cached data
   */
  async forceRefresh(): Promise<void> {
    this.initializeEmptyCache();
    this.saveCache();
    this.resetMetrics();
  }
  
  /**
   * Force refresh specific company's token
   */
  async forceRefreshToken(companyId: string): Promise<void> {
    this.cache.tokens.delete(companyId);
    this.saveCache();
  }
  
  /**
   * Force refresh company list
   */
  async forceRefreshCompanies(): Promise<void> {
    this.cache.companies = null;
    this.saveCache();
  }
  
  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Reset cache metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      lastReset: new Date()
    };
  }
  
  /**
   * Get cached company by ID or name
   */
  getCachedCompany(idOrName: string): Company | null {
    if (!this.cache.companies || !this.isValid(this.cache.companies)) {
      return null;
    }
    
    const companies = this.cache.companies.data;
    return companies.find(c => 
      c.id === idOrName || 
      c.name === idOrName || 
      c.realmId === idOrName
    ) || null;
  }
  
  /**
   * Update a specific token in the cache
   */
  updateToken(companyId: string, token: QuickBooksToken): void {
    this.cache.tokens.set(companyId, {
      data: token,
      expiresAt: token.expires_at
    });
    this.saveCache();
  }
}