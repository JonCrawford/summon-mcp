# QuickBooks MCP Desktop Extension

A powerful Desktop Extension (DXT) for Claude Desktop that enables seamless integration with QuickBooks Online through a centralized token broker architecture.

## Overview

This extension allows Claude to:
- Query multiple QuickBooks companies
- Generate financial reports
- List customers, invoices, payments, and more
- Automatically detect which company to query based on context
- Cache data locally for improved performance

## Architecture

The extension uses a **token broker** architecture:

```
Claude Desktop → QuickBooks MCP DXT → Token Broker → QuickBooks API
                        ↓
                   Local Cache
```

This design provides:
- **Security**: QuickBooks credentials never stored locally
- **Multi-tenancy**: Support for multiple QuickBooks companies
- **Performance**: Local caching reduces API calls
- **Reliability**: Works offline with cached data

## Prerequisites

1. **QuickBooks Token Broker**: You need a running token broker service. See [token-broker-prd.md](docs/token-broker-prd.md) for setup instructions.

2. **QuickBooks App**: Create a QuickBooks app at [developer.intuit.com](https://developer.intuit.com) to get OAuth credentials for the broker.

3. **Claude Desktop**: Version 0.7.0 or higher.

## Installation

### Option 1: Install Pre-built Extension

1. Download the latest `quickbooks-mcp.dxt` from the releases page
2. Open Claude Desktop
3. Go to Extensions → Install from file
4. Select the downloaded `.dxt` file

### Option 2: Build from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/quickbooks-mcp
   cd quickbooks-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build:dxt
   ```

4. Install the generated `quickbooks-mcp.dxt` file in Claude Desktop

## Configuration

After installation, configure the extension in Claude Desktop:

1. **Token Broker URL** (required)
   - URL of your token broker service
   - Example: `https://qb-broker.example.com`

2. **Broker API Token** (required)
   - Your authentication token for the broker
   - Get this from your broker administrator

3. **Default Company** (optional)
   - Name or ID of the default QuickBooks company
   - If not set, you'll need to specify the company in queries

4. **Cache Duration** (optional)
   - How long to cache company data (in hours)
   - Default: 24 hours
   - Range: 1-168 hours

5. **Enable Debug Logging** (optional)
   - Enable detailed logging for troubleshooting
   - Logs appear in Claude Desktop's developer console

## Setting Up the Token Broker

Before using this extension, you need a token broker service:

1. **Deploy the broker** (see [token-broker-prd.md](docs/token-broker-prd.md))

2. **Connect QuickBooks accounts**:
   ```bash
   # Visit your broker's OAuth URL
   https://your-broker.com/api/auth/quickbooks
   ```

3. **Get your API token** from the broker admin

4. **Test the connection**:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_TOKEN" \
        https://your-broker.com/api/tokens
   ```

## Usage

### Basic Commands

**List connected companies:**
```
Show me all connected QuickBooks companies
```

**Query specific company:**
```
Show me Acme Corp's invoices from last month
```

**Generate reports:**
```
Generate a profit and loss report for Widget Inc for Q1 2024
```

**Refresh cached data:**
```
Force refresh the QuickBooks cache
```

### Available Tools

| Tool | Description |
|------|-------------|
| `qb_list_companies` | List all connected QuickBooks companies |
| `qb_list_customers` | List customers from a company |
| `qb_list_invoices` | List invoices with optional date filtering |
| `qb_list_payments` | List payments received |
| `qb_list_vendors` | List vendors/suppliers |
| `qb_list_bills` | List bills to pay |
| `qb_list_items` | List products and services |
| `qb_list_accounts` | List chart of accounts |
| `qb_list_employees` | List employees |
| `qb_list_estimates` | List estimates/quotes |
| `qb_report` | Generate financial reports |
| `qb_cache_refresh` | Force refresh all cached data |
| `qb_cache_refresh_companies` | Refresh company list only |
| `qb_cache_refresh_token` | Refresh specific company's token |
| `qb_cache_stats` | View cache performance metrics |

### Multi-Company Usage

The extension automatically detects which company to query based on context:

```
"Show me invoices" → Uses default company or prompts if multiple
"Show me Acme Corp's invoices" → Automatically selects Acme Corp
"List Widget Inc customers" → Automatically selects Widget Inc
```

You can also specify the company explicitly:
```
List invoices with company parameter set to "Acme Corp"
```

### Report Types

Available report types for `qb_report`:
- `profit_and_loss` - Income statement
- `balance_sheet` - Financial position
- `cash_flow` - Cash flow statement
- `trial_balance` - Account balances
- `customer_sales` - Sales by customer
- `aging_summary` - A/R aging
- `vendor_balance` - A/P summary

## Performance Optimization

### Caching Strategy

Data is cached locally to improve performance:
- **Company list**: Cached for 24 hours (configurable)
- **Access tokens**: Cached until 5 minutes before expiry
- **Automatic refresh**: Tokens refresh proactively

### Cache Management

View cache statistics:
```
Show me the QuickBooks cache statistics
```

Force refresh when needed:
```
Refresh the QuickBooks cache for Acme Corp
```

## Troubleshooting

### Common Issues

**"No companies found"**
- Check broker connection: Use health check tool
- Verify API token is valid
- Ensure companies are connected in broker

**"Authentication failed"**
- Token may have expired
- Try: "Refresh QuickBooks token for [company]"
- Check broker logs

**"Rate limit exceeded"**
- QuickBooks API limit reached (500/minute)
- Wait a few minutes and retry
- Consider caching strategy

### Debug Mode

Enable debug logging in settings to see:
- API calls to broker
- Cache hit/miss rates
- Token refresh events
- Error details

Logs appear in:
- Claude Desktop: Developer → Console
- Log file: Check Claude Desktop logs directory

### Health Check

Run health check to verify setup:
```
Check QuickBooks MCP health status
```

This verifies:
- Extension is running
- Broker is accessible
- Configuration is valid

## Security Considerations

1. **Token Storage**
   - QuickBooks tokens stored only in broker
   - Local cache contains only temporary access tokens
   - Cache encrypted at rest (OS-dependent)

2. **API Token**
   - Broker API token stored in OS keychain
   - Never logged or transmitted insecurely
   - Revoke immediately if compromised

3. **Network Security**
   - All communication over HTTPS
   - Token broker should use TLS 1.2+
   - Consider VPN for sensitive data

## Development

### Building Locally

1. Clone and install:
   ```bash
   git clone https://github.com/your-org/quickbooks-mcp
   cd quickbooks-mcp
   npm install
   ```

2. Run tests:
   ```bash
   npm test
   ```

3. Build DXT:
   ```bash
   npm run build:dxt
   ```

### Project Structure

```
quickbooks-mcp/
├── src/
│   ├── server-broker.ts      # Main entry point
│   ├── quickbooks-broker.ts  # Broker client wrapper
│   ├── token-broker-client.ts # API client
│   ├── cache-manager.ts      # Caching logic
│   └── tools/               # MCP tool definitions
├── manifest.json            # DXT manifest
├── scripts/
│   └── package-dxt.js      # DXT packaging script
└── docs/
    └── token-broker-prd.md # Broker specifications
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Migration from Direct OAuth

If migrating from the direct OAuth version:

1. **Set up token broker** with your existing OAuth credentials
2. **Import existing tokens** into the broker (if applicable)
3. **Update Claude Desktop** configuration to use broker
4. **Remove local token files** (`tokens.json`)

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/quickbooks-mcp/issues)
- **Documentation**: [Wiki](https://github.com/your-org/quickbooks-mcp/wiki)
- **Token Broker**: See [token-broker-prd.md](docs/token-broker-prd.md)

## Roadmap

- [ ] Batch operations for multiple companies
- [ ] Natural language company detection improvements
- [ ] Webhook support for real-time updates
- [ ] Advanced caching strategies
- [ ] Offline mode enhancements