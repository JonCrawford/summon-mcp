/**
 * QuickBooks Report Types Mapping
 * Maps friendly report names to SDK method names
 */

export const reportTypes = {
  'profit_and_loss': 'reportProfitAndLoss',
  'balance_sheet': 'reportBalanceSheet',
  'cash_flow': 'reportCashFlow',
  'trial_balance': 'reportTrialBalance',
  'general_ledger': 'reportGeneralLedger',
  'customer_sales': 'reportCustomerSales',
  'item_sales': 'reportItemSales',
  'customer_balance': 'reportCustomerBalance',
  'customer_balance_detail': 'reportCustomerBalanceDetail',
  'aging_summary': 'reportAgedReceivables',
  'aging_detail': 'reportAgedReceivableDetail',
  'vendor_balance': 'reportVendorBalance',
  'vendor_balance_detail': 'reportVendorBalanceDetail',
  'vendor_aging': 'reportAgedPayables',
  'vendor_aging_detail': 'reportAgedPayableDetail',
  'inventory_summary': 'reportInventoryValuationSummary'
} as const;