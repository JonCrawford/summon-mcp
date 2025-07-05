# QuickBooks MCP - Quick Start Guide

## 🚀 5-Minute Setup

### Prerequisites
- Claude Desktop v0.7.0+
- Access to a QuickBooks Token Broker service
- Broker API token

### Step 1: Install the Extension

1. Download `quickbooks-mcp.dxt` from [releases](https://github.com/your-org/quickbooks-mcp/releases)
2. Open Claude Desktop
3. Navigate to **Extensions** → **Install from file**
4. Select the downloaded `.dxt` file

### Step 2: Configure

After installation, you'll see a configuration screen:

| Field | Description | Example |
|-------|-------------|---------|
| **Token Broker URL** | Your broker service URL | `https://qb-broker.example.com` |
| **Broker API Token** | Authentication token | `sk_live_abc123...` |
| **Default Company** | Optional default company | `Acme Corp` |

Click **Save** to apply settings.

### Step 3: Verify Connection

Ask Claude:
```
Check QuickBooks MCP health status
```

Expected response:
```json
{
  "status": "healthy",
  "broker": {
    "status": "connected"
  }
}
```

### Step 4: List Companies

```
Show me all connected QuickBooks companies
```

This shows all companies available through your broker.

## 🎯 Common Tasks

### View Recent Invoices
```
Show me invoices from the last 30 days
```

### Generate Financial Reports
```
Generate a profit and loss report for last month
```

### Check Specific Company
```
Show me Acme Corp's outstanding invoices
```

### Refresh Data
```
Refresh the QuickBooks cache
```

## 🔧 Troubleshooting

### No Companies Found
1. Check broker connection
2. Verify API token is correct
3. Ensure companies are connected in broker

### Authentication Errors
```
Refresh QuickBooks token for [company name]
```

### Performance Issues
```
Show me QuickBooks cache statistics
```

## 📚 Next Steps

- Read the full [README-DXT.md](../README-DXT.md)
- Learn about [multi-company usage](../README-DXT.md#multi-company-usage)
- Explore [available tools](../README-DXT.md#available-tools)
- Set up your own [token broker](token-broker-prd.md)

## 💡 Pro Tips

1. **Set a default company** to avoid specifying it each time
2. **Use natural language** - "Show me Acme's invoices" works!
3. **Cache lasts 24 hours** - force refresh only when needed
4. **Enable debug logging** for troubleshooting

## 🆘 Getting Help

- **Issues**: [GitHub Issues](https://github.com/your-org/quickbooks-mcp/issues)
- **Logs**: Claude Desktop → Developer → Console
- **Health Check**: "Check QuickBooks MCP health status"