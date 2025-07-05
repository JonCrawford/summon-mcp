# Node-QuickBooks Report Methods Analysis

## Available Report Methods

Based on my investigation of the node-quickbooks package, here are all the available report methods:

### Financial Reports
1. `reportBalanceSheet(options, callback)` - Balance Sheet report
2. `reportProfitAndLoss(options, callback)` - Profit and Loss (Income Statement) report
3. `reportProfitAndLossDetail(options, callback)` - Detailed Profit and Loss report
4. `reportTrialBalance(options, callback)` - Trial Balance report
5. `reportTrialBalanceFR(options, callback)` - Trial Balance FR report (French version?)
6. `reportCashFlow(options, callback)` - Cash Flow Statement
7. `reportGeneralLedgerDetail(options, callback)` - General Ledger with transaction details

### Sales Reports
8. `reportCustomerSales(options, callback)` - Sales by Customer Summary
9. `reportItemSales(options, callback)` - Sales by Product/Service Summary
10. `reportCustomerIncome(options, callback)` - Income by Customer Summary
11. `reportDepartmentSales(options, callback)` - Sales by Department
12. `reportClassSales(options, callback)` - Sales by Class

### Customer Reports
13. `reportCustomerBalance(options, callback)` - Customer Balance Summary
14. `reportCustomerBalanceDetail(options, callback)` - Customer Balance Detail
15. `reportAgedReceivables(options, callback)` - A/R Aging Summary
16. `reportAgedReceivableDetail(options, callback)` - A/R Aging Detail

### Vendor Reports
17. `reportVendorBalance(options, callback)` - Vendor Balance Summary
18. `reportVendorBalanceDetail(options, callback)` - Vendor Balance Detail
19. `reportAgedPayables(options, callback)` - A/P Aging Summary
20. `reportAgedPayableDetail(options, callback)` - A/P Aging Detail
21. `reportVendorExpenses(options, callback)` - Expenses by Vendor Summary

### Transaction Reports
22. `reportTransactionList(options, callback)` - Transaction List by Date
23. `reportTransactionListWithSplits(options, callback)` - Transaction List with Splits
24. `reportTransactionListByCustomer(options, callback)` - Transaction List by Customer
25. `reportTransactionListByVendor(options, callback)` - Transaction List by Vendor

### Other Reports
26. `reportInventoryValuationSummary(options, callback)` - Inventory Valuation Summary
27. `reportTaxSummary(options, callback)` - Sales Tax Liability Report
28. `reportAccountListDetail(options, callback)` - Chart of Accounts
29. `reportJournalReport(options, callback)` - Journal Report

## Generic Report Method

The underlying implementation uses a generic `module.report()` function:

```javascript
module.report = function(context, reportType, criteria, callback) {
  var url = '/reports/' + reportType
  if (criteria && typeof criteria !== 'function') {
    url += module.reportCriteria(criteria) || ''
  }
  module.request(context, 'get', {url: url}, null, typeof criteria === 'function' ? criteria : callback)
}
```

This means that all report methods follow the pattern:
- They call `module.report()` with the report type name
- The report type is appended to `/reports/` to form the API endpoint
- Options are converted to query parameters

## Report Options

All reports accept an `options` object that can include parameters such as:
- `start_date` - Start date for the report period
- `end_date` - End date for the report period
- `accounting_method` - Cash or Accrual
- `summarize_column_by` - How to group columns (Days, Weeks, Months, Quarters, Years, Customers, Vendors, Classes, Departments, Employees, ProductsAndServices)
- `department` - Filter by department ID(s)
- `class` - Filter by class ID(s)
- And many other report-specific parameters

## Design Recommendations

For your MCP server, I recommend:

1. **Create a single unified report tool** instead of individual tools for each report type
2. **Use the report type as a parameter** to leverage the existing pattern
3. **Map friendly names to report types** for better usability

Example tool design:
```javascript
{
  name: 'qb.report',
  description: 'Generate various QuickBooks reports',
  parameters: {
    reportType: {
      type: 'string',
      enum: [
        'balance_sheet',
        'profit_and_loss',
        'profit_and_loss_detail',
        'trial_balance',
        'cash_flow',
        'customer_balance',
        'aged_receivables',
        'vendor_balance',
        'aged_payables',
        'transaction_list',
        // ... etc
      ],
      description: 'Type of report to generate'
    },
    startDate: { type: 'string', format: 'date', optional: true },
    endDate: { type: 'string', format: 'date', optional: true },
    accountingMethod: { 
      type: 'string', 
      enum: ['Cash', 'Accrual'], 
      optional: true 
    },
    summarizeBy: {
      type: 'string',
      enum: ['Days', 'Weeks', 'Months', 'Quarters', 'Years', 'Customers', 'Vendors', 'Classes', 'Departments'],
      optional: true
    }
  }
}
```

Then map the friendly names to the actual method names:
```javascript
const reportMethodMap = {
  'balance_sheet': 'reportBalanceSheet',
  'profit_and_loss': 'reportProfitAndLoss',
  'profit_and_loss_detail': 'reportProfitAndLossDetail',
  // ... etc
};
```

This approach provides:
- A single, discoverable tool for all reports
- Consistent parameter handling
- Easy extension for new report types
- Better user experience with friendly names