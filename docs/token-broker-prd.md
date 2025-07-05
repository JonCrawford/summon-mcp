# QuickBooks Token Broker Service - Product Requirements Document

## Overview

The QuickBooks Token Broker is a centralized web service that manages OAuth authentication and token lifecycle for multiple QuickBooks Online companies. It serves as an authentication proxy for MCP servers and other clients that need QuickBooks access without managing OAuth flows directly.

## Problem Statement

Desktop Extensions (DXT) and MCP servers cannot run web servers for OAuth callbacks, making it impossible to complete the QuickBooks OAuth flow directly. Additionally, managing tokens for multiple QuickBooks companies requires centralized coordination to prevent token conflicts and ensure proper refresh cycles.

## Goals

1. **Centralized OAuth Management**: Handle all QuickBooks OAuth flows in one service
2. **Multi-Tenant Support**: Manage tokens for multiple QuickBooks companies per user
3. **Token Security**: Secure storage and transmission of sensitive tokens
4. **High Availability**: Ensure tokens are always available when needed
5. **Easy Integration**: Simple API for clients to retrieve fresh tokens

## Non-Goals

1. QuickBooks API proxying (clients connect directly to QuickBooks)
2. User management beyond API key authentication
3. Complex permission models (all-or-nothing access per API key)
4. Data persistence beyond tokens and minimal metadata

## Technical Architecture

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js or Fastify
- **OAuth Library**: [intuit-oauth](https://www.npmjs.com/package/intuit-oauth) v4.x
- **Database**: PostgreSQL or SQLite (for simplicity)
- **Cache**: Redis (optional, for performance)
- **Authentication**: API key-based with optional JWT

### Core Components

1. **OAuth Manager**
   - Uses intuit-oauth library for OAuth 2.0 flow
   - Handles authorization URL generation
   - Processes OAuth callbacks
   - Manages token refresh automatically

2. **Token Store**
   - Encrypted storage of refresh tokens
   - Metadata: company name, realm ID, last accessed
   - Token expiration tracking
   - Automatic cleanup of expired tokens

3. **API Gateway**
   - RESTful API endpoints
   - API key authentication
   - Rate limiting per API key
   - Request/response logging

4. **Background Workers**
   - Proactive token refresh (before expiration)
   - Expired token cleanup
   - Health monitoring

## API Specification

### Authentication

All API requests require an API key in the Authorization header:
```
Authorization: Bearer {api_key}
```

### Endpoints

#### 1. Initialize OAuth Flow
```
POST /api/auth/quickbooks
Content-Type: application/json

{
  "companyAlias": "Acme Corp",  // Optional friendly name
  "metadata": {}                 // Optional metadata
}

Response:
{
  "authUrl": "https://appcenter.intuit.com/connect/oauth2?...",
  "sessionId": "temp_session_123",
  "expiresAt": "2024-01-01T12:00:00Z"
}
```

#### 2. Complete OAuth Flow
```
GET /api/auth/callback?code={code}&realmId={realmId}&state={state}

Response: HTML page with success/error message
```

#### 3. List Connected Companies
```
GET /api/tokens

Response:
[
  {
    "id": "company_123",
    "name": "Acme Corp",
    "realmId": "123456789",
    "createdAt": "2024-01-01T10:00:00Z",
    "lastAccessed": "2024-01-01T11:00:00Z",
    "tokenStatus": "active"
  }
]
```

#### 4. Get Access Token
```
GET /api/tokens/{companyIdOrName}

Response:
{
  "access_token": "eyJ...",
  "realm_id": "123456789", 
  "company_name": "Acme Corp",
  "expires_at": 1704120000000,
  "refresh_token": "RT1-..." // Only if client needs it
}
```

#### 5. Revoke Company Connection
```
DELETE /api/tokens/{companyIdOrName}

Response:
{
  "status": "revoked",
  "company": "Acme Corp"
}
```

#### 6. Health Check
```
GET /health

Response:
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600
}
```

### Error Responses

```json
{
  "error": {
    "code": "COMPANY_NOT_FOUND",
    "message": "Company 'Acme Corp' not found",
    "details": {}
  }
}
```

Error codes:
- `INVALID_API_KEY` - 401
- `COMPANY_NOT_FOUND` - 404
- `TOKEN_EXPIRED` - 401
- `OAUTH_FAILED` - 400
- `RATE_LIMIT_EXCEEDED` - 429
- `INTERNAL_ERROR` - 500

## Security Considerations

1. **Token Encryption**
   - Refresh tokens encrypted at rest using AES-256
   - Encryption keys rotated quarterly
   - Access tokens not stored (generated on demand)

2. **API Key Management**
   - API keys hashed using bcrypt
   - Keys can be revoked immediately
   - Rate limiting per key (e.g., 100 requests/minute)

3. **Network Security**
   - HTTPS only (TLS 1.2+)
   - CORS configured for OAuth callback only
   - IP allowlisting (optional)

4. **Audit Logging**
   - All token access logged
   - OAuth flow events tracked
   - Suspicious activity monitoring

## Data Model

### API Keys Table
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  metadata JSONB
);
```

### Companies Table
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id),
  realm_id VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  alias VARCHAR(255),
  created_at TIMESTAMP NOT NULL,
  last_accessed_at TIMESTAMP,
  metadata JSONB,
  UNIQUE(api_key_id, realm_id)
);
```

### Tokens Table
```sql
CREATE TABLE tokens (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMP NOT NULL,
  refresh_token_expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

## Implementation with intuit-oauth

### OAuth Client Setup
```typescript
import OAuthClient from 'intuit-oauth';

const oauthClient = new OAuthClient({
  clientId: process.env.INTUIT_CLIENT_ID,
  clientSecret: process.env.INTUIT_CLIENT_SECRET,
  environment: process.env.QB_ENVIRONMENT || 'sandbox',
  redirectUri: `${process.env.BASE_URL}/api/auth/callback`,
  logging: true
});
```

### Token Refresh Logic
```typescript
async function getAccessToken(companyId: string): Promise<TokenResponse> {
  const tokenData = await getStoredToken(companyId);
  
  // Check if access token is still valid (with 5 min buffer)
  if (tokenData.expiresAt > Date.now() + 300000) {
    return tokenData;
  }
  
  // Refresh the token
  oauthClient.setToken({
    refresh_token: decrypt(tokenData.refreshTokenEncrypted),
    access_token: tokenData.lastAccessToken // May be expired
  });
  
  const authResponse = await oauthClient.refreshUsingToken(
    tokenData.refreshToken
  );
  
  // Update stored tokens
  await updateStoredToken(companyId, authResponse);
  
  return {
    access_token: authResponse.access_token,
    expires_at: Date.now() + (authResponse.expires_in * 1000),
    // ... other fields
  };
}
```

## Performance Requirements

1. **API Response Times**
   - GET /api/tokens: < 100ms
   - GET /api/tokens/{id}: < 200ms (with cache)
   - Token refresh: < 1s

2. **Availability**
   - 99.9% uptime SLA
   - Graceful degradation if QuickBooks is down
   - Cached tokens served during outages

3. **Scalability**
   - Support 10,000+ companies
   - 1000+ concurrent token requests
   - Horizontal scaling capability

## Monitoring & Observability

1. **Metrics**
   - Token refresh success/failure rates
   - API response times (P50, P95, P99)
   - Active companies per API key
   - Token expiration warnings

2. **Alerts**
   - Token refresh failures > 5%
   - API errors > 1%
   - Database connection issues
   - QuickBooks API rate limits

3. **Logging**
   - Structured JSON logs
   - Correlation IDs for request tracking
   - PII redaction in logs

## Migration & Deployment

### Phase 1: MVP
- Basic OAuth flow
- Single-tenant (one company per API key)
- SQLite database
- Manual API key management

### Phase 2: Multi-Tenant
- Multiple companies per API key
- PostgreSQL migration
- Automated token refresh
- Basic monitoring

### Phase 3: Production Ready
- Redis caching
- Advanced monitoring
- Rate limiting
- Audit logging

### Phase 4: Enterprise
- High availability setup
- Advanced security features
- Compliance certifications
- SLA guarantees

## Success Metrics

1. **Adoption**
   - Number of active API keys
   - Companies connected per key
   - Daily active tokens

2. **Reliability**
   - Token refresh success rate > 99.5%
   - API uptime > 99.9%
   - P95 response time < 200ms

3. **Security**
   - Zero token leaks
   - 100% encrypted storage
   - Audit compliance pass

## Open Questions

1. Should we support OAuth scopes limitation per company?
2. Do we need webhook support for token expiration events?
3. Should the service proxy QuickBooks API calls in the future?
4. What's the token retention policy for disconnected companies?
5. Do we need different API key tiers with different rate limits?

## Appendix: QuickBooks OAuth Considerations

### Token Lifetimes
- Access tokens: 1 hour
- Refresh tokens: 100 days
- Must refresh before expiration to maintain access

### OAuth Scopes
- `com.intuit.quickbooks.accounting` - Full accounting access
- `com.intuit.quickbooks.payment` - Payment processing (if needed)
- `openid` - Basic profile information

### Environment URLs
- Sandbox: Uses same OAuth URLs but different API endpoints
- Production: Same URLs, different client credentials

### Rate Limits
- QuickBooks API: 500 requests per minute per realm
- Token refresh: No specific limit but should minimize

### Best Practices
1. Always use HTTPS for OAuth redirects
2. Implement PKCE for additional security
3. Store minimal token data
4. Log token access for audit trails
5. Implement automatic retry with exponential backoff