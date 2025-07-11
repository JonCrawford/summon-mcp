# QuickBooks MCP Server - Project Instructions

## Overview

This project uses the SUMmon QuickBooks MCP server to access QuickBooks Online data. The server provides read-only access to QuickBooks entities through natural language queries.

## Critical: Always Identify the Company

**When using ANY QuickBooks tool, you MUST always clearly state which company you're working with.** This is non-negotiable for financial data accuracy and user trust.

### Why This Matters

-   Users often have access to multiple QuickBooks companies (as accountants, consultants, or business owners)
-   Users may not remember which specific company they authenticated
-   Financial data is sensitive and company-specific
-   Mixing up companies could have serious consequences

## Authentication Behavior

**When a user requests QuickBooks data and you're not authenticated:**

1. The user's request for data IS implicit permission to authenticate
2. Don't ask "Would you like me to authenticate?" - just do it
3. Briefly explain you're connecting, then run `authenticate`
4. After authentication, immediately fulfill their original request

This provides a smooth user experience without unnecessary back-and-forth.

## How to Use QuickBooks Tools

### 1. Start with Health Check (One-Stop Status)

**Always begin with a single health check that gives you everything you need:**

```
health_check
```

This single tool call now returns:

-   Server status and mode
-   Authentication status
-   **Connected companies list** (if authenticated)
-   Company-specific instructions
-   Any configuration issues

Example response when authenticated:

```json
{
    "status": "Server is running in production mode",
    "mode": "production",
    "authenticated": true,
    "credentials_configured": true,
    "companies": [
        {
            "name": "QuickBooks Company",
            "realmId": "9341454914780836"
        }
    ],
    "_instruction": "Currently connected to one QuickBooks company: \"QuickBooks Company\" (Realm ID: 9341454914780836). When performing operations, always mention this company name."
}
```

**You no longer need to call `qb_list_companies` separately** - the health check provides all startup information in one efficient call.

### 2. Use the Company Information

From the health_check response:

-   If `authenticated: false` - prompt user to authenticate
-   If `companies` array is present - use the realm ID for subsequent calls
-   Always follow the `_instruction` guidance for how to communicate

### 3. Understanding Tool Responses

All QuickBooks tool responses include a `_context` field with:

-   `company_name`: The name of the company being queried
-   `realm_id`: The unique identifier for the company
-   `_instruction`: Specific guidance on how to present the data
-   Additional notes about data interpretation (e.g., metadata clarifications)

**ALWAYS use this context information when presenting data to users.**

### 4. Using Entity Tools

When querying QuickBooks data:

#### IMPORTANT: Always Use Realm ID When Available

**Best Practice**: Always include the `realmId` parameter in your tool calls when you know it. This ensures you're querying the correct company and makes your queries explicit and reproducible.

After running `qb_list_companies`, use the realm ID from the response:

```
qb_list_invoices
{
  "realmId": "9341454914780836",
  "limit": 20,
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

#### Single Company Scenario

If only one company is connected and you don't specify a realm ID, the tool will automatically use it:

```
qb_list_invoices
{
  "limit": 20
}
```

But it's better to be explicit and include the realm ID even with one company.

#### Multiple Companies Scenario

You MUST specify the realm ID - the tool will error if you don't:

```
qb_list_invoices
{
  "realmId": "9341454914780836",
  "limit": 20
}
```

Always ask users which company they want to query if multiple are available.

#### Remember

-   Get realm IDs from `qb_list_companies`
-   Always prefer using the realm ID explicitly
-   The realm ID is permanent and unique per company
-   Company names might change, but realm IDs don't

### 5. Important Data Clarifications

#### Company Info Dates

When using `qb_company_info`:

-   `MetaData.CreateTime` is when the QuickBooks account was created, NOT when the business was founded
-   Look for `CompanyStartDate` or similar fields for actual business formation date
-   Don't confuse QuickBooks account creation with business establishment

#### Financial Reports

When using `qb_report`:

-   Always specify the report type, start date, and end date
-   Include the period in your response: "This Profit & Loss report for **Bob's Bakery** covers January to December 2024"
-   Note the accounting method if specified (Cash vs Accrual)

## Examples of Good Communication

✓ "I've retrieved 15 invoices from **Acme Corporation** for December 2024. Here's what I found..."

✓ "The profit and loss report for **Bob's Bakery** (January-December 2024) shows..."

✓ "**Tech Startup Inc** has 42 active customers in their QuickBooks system..."

✓ "Looking at **Smith Consulting LLC**'s vendor list, I can see you work with 18 suppliers..."

## Examples of Poor Communication

✗ "Here are the invoices..." (Which company?)

✗ "The financial data shows..." (Whose financial data?)

✗ "I've fetched the customer list..." (From which business?)

✗ "Your business was created in 2025..." (Misinterpreting MetaData.CreateTime)

## Available Tools

### Authentication & Setup

-   `health_check` - Check server status and connection
-   `authenticate` - Connect to QuickBooks (opens browser for OAuth)
-   `clear_auth` - Disconnect from QuickBooks
-   `qb_list_companies` - List all connected QuickBooks companies

### Company Information

-   `qb_company_info` - Get detailed company information

### Entity Queries

-   `qb_list_customers` - List customers
-   `qb_list_invoices` - List invoices
-   `qb_list_payments` - List payments received
-   `qb_list_vendors` - List vendors/suppliers
-   `qb_list_items` - List products and services
-   `qb_list_accounts` - List chart of accounts
-   `qb_list_bills` - List bills/payables
-   `qb_list_estimates` - List quotes/estimates
-   `qb_list_employees` - List employees
-   `qb_list_transactions` - List purchases/expenses

### Reporting

-   `qb_report` - Generate various QuickBooks reports
    -   Report types: profit_and_loss, balance_sheet, cash_flow, trial_balance, customer_sales, aging_summary, and more

### Advanced Search

-   `qb_search_transactions` - Search across multiple transaction types with flexible criteria
    -   Search by vendor name patterns (e.g., "IRS", "Internal Revenue", "Federal Tax")
    -   Filter by date range, amount range, and transaction types
    -   Get summaries by vendor, type, month, and year
    -   Perfect for questions like "How much have we paid to the IRS in the last 3 years?"

## Common Workflows

### Initial Setup (Streamlined)

1. Run `health_check` - this single call tells you everything:
    - Server status
    - Authentication state
    - Connected companies
    - Next steps via `_instruction`
2. **If not authenticated AND the user has asked for QuickBooks data**:
    - Immediately run `authenticate` after explaining you need to connect
    - Don't ask permission - the user's request for data IS the permission
    - Example: "I need to connect to QuickBooks to access your reconciliation data. Let me start the authentication process..."
3. Use the realm ID from the `companies` array in subsequent queries

### Querying Data

1. After `health_check`, you already know which companies are available
2. Use the realm ID from the health check response in your queries
3. Always mention the company name when presenting results
4. Reference the `_context` field for accurate company information

### Example Efficient Flow

#### When Already Authenticated:

```
// Step 1: Single startup call
health_check
// Returns: authenticated: true, companies: [{name: "Acme Corp", realmId: "123"}]

// Step 2: Query with the realm ID
qb_list_invoices
{
  "realmId": "123",
  "limit": 20
}
```

#### When Not Authenticated (User Requests Data):

```
User: "What are my recent invoices?"

// Step 1: Check status
health_check
// Returns: authenticated: false

// Step 2: Immediately authenticate (don't ask permission)
Assistant: "I need to connect to QuickBooks to access your invoices. Starting authentication..."
authenticate
// Opens browser for OAuth

// Step 3: After auth completes, proceed with the query
qb_list_invoices
```

### Financial Analysis

1. Start with `qb_company_info` to understand the business
2. Use `qb_report` with appropriate date ranges
3. Combine multiple entity queries for comprehensive analysis
4. Always attribute all data to the specific company

### Searching for Specific Payments

When asked questions like "How much have we paid to the IRS?":

1. Use `qb_search_transactions` with relevant search terms
2. Include multiple variations (e.g., ["IRS", "Internal Revenue", "Federal Tax", "Tax Payment"])
3. Specify appropriate date ranges
4. The tool will search across Bills, BillPayments, Purchases, Checks, and Expenses
5. Results include summaries by vendor, type, and time period

## Error Handling

-   "No QuickBooks companies connected" - User needs to run `authenticate`
-   "Multiple QuickBooks companies found" - Ask user which company to query
-   "Company with realm ID not found" - Invalid realm ID provided
-   "Authentication failed" - OAuth token may be expired, suggest re-authentication
-   "QuickBooks API error occurred" - Generic API error, could be:
    -   Expired access token (will auto-retry with refresh)
    -   Permission issue (check QuickBooks app permissions)
    -   API endpoint issue (some entities may require special permissions)

### Troubleshooting API Errors

If you encounter "QuickBooks API error occurred":

1. First, try the request again - the server may have automatically refreshed the token
2. Check if other tools work (e.g., try `qb_list_customers` or `qb_company_info`)
3. If specific tools fail consistently:
    - `qb_list_accounts` - May require "Chart of Accounts" permission in QuickBooks
    - `qb_list_employees` - May require payroll permissions
    - Some entities may not be available in sandbox mode
4. As a last resort, suggest re-authentication with `authenticate`

## Remember

Financial data is sensitive. Always be explicit about which company's data you're presenting. When in doubt, check the `_context` field and use the company name in every response.
