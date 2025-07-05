import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { CacheManager } from '../cache-manager.js';

/**
 * Register cache management tools with the MCP server
 * @param mcp - The FastMCP instance
 * @param cacheManager - The cache manager instance
 */
export function registerCacheTools(mcp: FastMCP, cacheManager: CacheManager): void {
  // Force refresh entire cache
  mcp.addTool({
    name: 'qb_cache_refresh',
    description: 'Force refresh all cached QuickBooks data (companies and tokens)',
    parameters: z.object({}),
    execute: async () => {
      try {
        await cacheManager.forceRefresh();
        
        const metrics = cacheManager.getMetrics();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Cache has been cleared successfully',
              metrics: {
                previousHits: metrics.hits,
                previousMisses: metrics.misses,
                previousErrors: metrics.errors,
                cacheResetAt: new Date().toISOString()
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to refresh cache: ${error instanceof Error ? error.message : error}`);
      }
    }
  });
  
  // Force refresh company list only
  mcp.addTool({
    name: 'qb_cache_refresh_companies',
    description: 'Force refresh the cached list of QuickBooks companies',
    parameters: z.object({}),
    execute: async () => {
      try {
        await cacheManager.forceRefreshCompanies();
        
        // Immediately fetch fresh data to populate cache
        const companies = await cacheManager.getCompanies();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Company list cache has been refreshed',
              companiesCount: companies.length,
              companies: companies.map(c => ({
                id: c.id,
                name: c.name,
                realmId: c.realmId
              }))
            }, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to refresh company cache: ${error instanceof Error ? error.message : error}`);
      }
    }
  });
  
  // Force refresh specific company token
  mcp.addTool({
    name: 'qb_cache_refresh_token',
    description: 'Force refresh the cached token for a specific QuickBooks company',
    parameters: z.object({
      company: z.string().describe('Company ID, name, or realm ID')
    }),
    execute: async (args) => {
      try {
        // First, get the company to ensure it exists
        const companies = await cacheManager.getCompanies();
        const company = companies.find(c => 
          c.id === args.company || 
          c.name === args.company || 
          c.realmId === args.company
        );
        
        if (!company) {
          throw new Error(`Company "${args.company}" not found`);
        }
        
        // Force refresh the token
        await cacheManager.forceRefreshToken(company.id);
        
        // Fetch fresh token to populate cache
        const token = await cacheManager.getAccessToken(company.id);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: `Token refreshed for company "${company.name}"`,
              company: {
                id: company.id,
                name: company.name,
                realmId: company.realmId
              },
              tokenExpiresAt: new Date(token.expires_at).toISOString()
            }, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : error}`);
      }
    }
  });
  
  // Get cache statistics
  mcp.addTool({
    name: 'qb_cache_stats',
    description: 'Get cache statistics and performance metrics',
    parameters: z.object({}),
    execute: async () => {
      try {
        const metrics = cacheManager.getMetrics();
        const companies = await cacheManager.getCompanies();
        
        // Calculate cache hit rate
        const totalRequests = metrics.hits + metrics.misses;
        const hitRate = totalRequests > 0 
          ? ((metrics.hits / totalRequests) * 100).toFixed(2) 
          : '0.00';
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              cacheMetrics: {
                hits: metrics.hits,
                misses: metrics.misses,
                errors: metrics.errors,
                hitRate: `${hitRate}%`,
                lastReset: metrics.lastReset.toISOString()
              },
              cachedData: {
                companiesCount: companies.length,
                companies: companies.map(c => ({
                  name: c.name,
                  lastAccessed: c.lastAccessed || 'never'
                }))
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get cache stats: ${error instanceof Error ? error.message : error}`);
      }
    }
  });
}