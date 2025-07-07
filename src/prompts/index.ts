/**
 * QuickBooks Workflow Prompts
 * 
 * User-controlled interaction templates for common QuickBooks workflows
 */

import { FastMCP } from 'fastmcp';

/**
 * Register all QuickBooks workflow prompts
 */
export function registerQuickBooksPrompts(mcp: FastMCP): void {
  
  // Financial Analysis Workflow
  mcp.addPrompt({
    name: 'analyze-financial-performance',
    description: 'Guide through comprehensive financial performance analysis using P&L and Balance Sheet',
    arguments: [
      {
        name: 'period',
        description: 'Analysis period (e.g., "2024-Q1", "2024-01" for January, or "2024" for full year)',
        required: true
      },
      {
        name: 'comparison_period', 
        description: 'Optional comparison period for trend analysis',
        required: false
      }
    ],
    load: async (args) => {
      const period = args.period || 'current-year';
      const comparison = args.comparison_period ? ` vs ${args.comparison_period}` : '';
      
      return `# Financial Performance Analysis${comparison}

## Analysis Checklist for ${period}

### 1. Revenue Analysis
- Review **Profit & Loss** report: \`qb://reports/profit_and_loss?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD\`
- Analyze revenue trends and seasonality
- Compare to budget/previous period
- Identify top revenue sources

### 2. Expense Review  
- Break down expense categories from P&L
- Calculate expense ratios (% of revenue)
- Identify unusual or significant changes
- Review cost of goods sold if applicable

### 3. Profitability Metrics
- Calculate gross profit margin
- Analyze net profit margin
- Review operating expense ratio
- Assess cash flow from operations

### 4. Balance Sheet Health
- Review **Balance Sheet**: \`qb://reports/balance_sheet?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD\`
- Analyze current ratio (current assets/current liabilities)
- Review debt-to-equity ratio
- Check accounts receivable aging
- Assess inventory levels if applicable

### 5. Cash Flow Analysis
- Review **Cash Flow** statement: \`qb://reports/cash_flow?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD\`
- Analyze cash from operations
- Review financing activities
- Assess investment activities

### Key Questions to Address:
1. Is revenue growing or declining? What are the drivers?
2. Are expenses controlled and reasonable?
3. Is the business profitable? Trending up or down?
4. Is cash flow positive? Any concerns?
5. What opportunities exist for improvement?

**Next Steps**: Based on analysis, identify action items for improvement and set targets for next period.`;
    }
  });

  // Customer Management Workflow
  mcp.addPrompt({
    name: 'review-customer-aging',
    description: 'Customer collections and aging analysis workflow',
    arguments: [
      {
        name: 'aging_threshold',
        description: 'Days threshold for aged receivables (default: 30)',
        required: false
      }
    ],
    load: async (args) => {
      const threshold = args.aging_threshold || '30';
      
      return `# Customer Aging Review & Collections Workflow

## Step-by-Step Process

### 1. Generate Aging Reports
- **Aging Summary**: \`qb://reports/aging_summary\`
- **Aging Detail**: \`qb://reports/aging_detail\`
- Review accounts receivable over ${threshold} days

### 2. Customer Analysis
- Get customer list: \`qb://customers\`
- Review customer payment history
- Identify repeat late payers
- Check credit limits and terms

### 3. Collections Priority
**High Priority (90+ days):**
- Contact immediately
- Consider collection agency
- Evaluate credit hold

**Medium Priority (60-89 days):**
- Send payment reminder
- Phone call follow-up
- Review payment terms

**Standard Follow-up (30-59 days):**
- Email reminder
- Review invoice accuracy
- Confirm customer received invoice

### 4. Prevention Strategies
- Review credit application process
- Update payment terms if needed
- Consider requiring deposits
- Implement automatic payment reminders

### 5. Documentation
- Log all customer communications
- Update customer records
- Track collection success rates
- Monitor aging trends monthly

**Goal**: Reduce aged receivables and improve cash flow through systematic collections management.`;
    }
  });

  // Monthly Close Process
  mcp.addPrompt({
    name: 'monthly-close-checklist',
    description: 'End-of-month accounting close procedures and checklist',
    arguments: [
      {
        name: 'month',
        description: 'Month being closed (YYYY-MM format)',
        required: true
      }
    ],
    load: async (args) => {
      const month = args.month || new Date().toISOString().slice(0, 7);
      
      return `# Monthly Close Checklist - ${month}

## Pre-Close Preparation

### 1. Data Entry Verification
- [ ] All invoices entered for ${month}
- [ ] All bills and expenses recorded
- [ ] Bank deposits reconciled
- [ ] Credit card transactions entered

### 2. Account Reconciliation
- [ ] Bank reconciliation completed
- [ ] Credit card reconciliation
- [ ] PayPal/payment processor reconciliation
- [ ] Petty cash count and reconciliation

### 3. Review Key Reports
- [ ] **Trial Balance**: \`qb://reports/trial_balance?startDate=${month}-01&endDate=${month}-31\`
- [ ] **P&L Statement**: \`qb://reports/profit_and_loss?startDate=${month}-01&endDate=${month}-31\`
- [ ] **Balance Sheet**: \`qb://reports/balance_sheet?endDate=${month}-31\`

## Close Procedures

### 4. Adjusting Entries
- [ ] Accrued expenses (utilities, rent, etc.)
- [ ] Prepaid expense adjustments
- [ ] Depreciation entries
- [ ] Accrued revenue if applicable
- [ ] Inventory adjustments (if applicable)

### 5. Review & Analysis
- [ ] Compare actual vs budget
- [ ] Analyze significant variances
- [ ] Review expense ratios
- [ ] Check for unusual transactions

### 6. Compliance & Reporting
- [ ] Sales tax calculation and filing
- [ ] Payroll tax verification
- [ ] 1099 tracking (if applicable)
- [ ] Financial statement preparation

## Post-Close Activities

### 7. Month-End Analysis
- [ ] Key performance indicators (KPIs)
- [ ] Cash flow analysis
- [ ] Customer aging review
- [ ] Vendor payment scheduling

### 8. Documentation
- [ ] File supporting documents
- [ ] Document any unusual entries
- [ ] Update close procedures if needed
- [ ] Prepare management reports

**Timeline Goal**: Complete close within 5-7 business days of month-end.`;
    }
  });

  // QuickBooks Setup Guidance
  mcp.addPrompt({
    name: 'setup-quickbooks-connection',
    description: 'Initial QuickBooks connection and configuration guidance',
    arguments: [],
    load: async () => {
      return `# QuickBooks Connection Setup Guide

## Initial Connection

### 1. Prerequisites
- QuickBooks Online account (sandbox or production)
- Intuit Developer Account (for API access)
- OAuth application configured at developer.intuit.com

### 2. Configuration Steps
- Set environment variables:
  - \`QB_CLIENT_ID\`: Your Intuit app's client ID
  - \`QB_CLIENT_SECRET\`: Your Intuit app's client secret
  - \`QUICKBOOKS_PRODUCTION\`: 'true' for production, 'false' for sandbox

### 3. Authentication
- Check current status: \`qb://auth/status\`
- Use health_check tool to verify server connectivity
- Follow OAuth flow when prompted

## Initial Data Exploration

### 4. Company Information
- Review company details: \`qb://company/info\`
- Check available data: \`qb://metadata\`

### 5. Chart of Accounts
- Review account structure: \`qb://accounts\`
- Understand account types and hierarchy

### 6. Basic Data Review
**Customers**: \`qb://customers?limit=10\`
**Vendors**: \`qb://vendors?limit=10\`
**Items/Products**: \`qb://items?limit=10\`

## Common Use Cases

### 7. Financial Reporting
- Monthly P&L: \`qb://reports/profit_and_loss\`
- Balance Sheet: \`qb://reports/balance_sheet\`
- Cash Flow: \`qb://reports/cash_flow\`

### 8. Transaction Analysis
- Recent invoices: \`qb://invoices?limit=20\`
- Recent payments: \`qb://payments?limit=20\`
- Bills to pay: \`qb://bills?limit=20\`

## Best Practices

### 9. Data Management
- Regular reconciliation procedures
- Consistent naming conventions
- Proper account classifications
- Regular backup procedures

### 10. Security
- Secure credential storage
- Regular access review
- Monitor for unusual activity
- Keep software updated

**Next Steps**: Once connected, explore specific workflows using other available prompts for financial analysis, customer management, and monthly closing procedures.`;
    }
  });

  // Invoice Analysis Workflow
  mcp.addPrompt({
    name: 'analyze-sales-performance',
    description: 'Sales performance analysis using invoice and customer data',
    arguments: [
      {
        name: 'period',
        description: 'Analysis period (e.g., "2024-Q1", "last-30-days")',
        required: true
      }
    ],
    load: async (args) => {
      const period = args.period || 'current-month';
      
      return `# Sales Performance Analysis - ${period}

## Revenue Analysis Workflow

### 1. Invoice Analysis
- Review recent invoices: \`qb://invoices?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&limit=100\`
- Calculate total revenue for period
- Analyze invoice frequency and timing
- Review average invoice size

### 2. Customer Performance
- Get customer list: \`qb://customers\`
- Run customer sales report: \`qb://reports/customer_sales?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD\`
- Identify top customers by revenue
- Analyze customer concentration risk

### 3. Product/Service Analysis
- Review items/services: \`qb://items\`
- Run item sales report: \`qb://reports/item_sales?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD\`
- Identify best-performing products/services
- Calculate product mix percentages

### 4. Sales Trends
- Compare current period to previous periods
- Identify seasonal patterns
- Track growth rates
- Analyze sales cycle timing

## Key Metrics to Calculate

### 5. Performance Indicators
- **Revenue Growth**: Period-over-period change
- **Average Deal Size**: Total revenue / number of invoices
- **Customer Acquisition**: New customers added
- **Customer Retention**: Repeat customer rate
- **Sales Velocity**: Time from quote to payment

### 6. Analysis Questions
1. Which customers drive the most revenue?
2. What products/services are most profitable?
3. Are there seasonal trends to consider?
4. How does this period compare to targets?
5. What opportunities exist for growth?

## Action Items

### 7. Growth Opportunities
- Upselling to existing customers
- Cross-selling complementary services
- Targeting underperforming segments
- Optimizing pricing strategies

### 8. Process Improvements
- Streamline invoicing process
- Improve payment terms
- Enhance customer communication
- Optimize product mix

**Outcome**: Data-driven insights to improve sales performance and strategic decision-making.`;
    }
  });
}