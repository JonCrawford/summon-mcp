/**
 * Entity mappings for QuickBooks SDK functions
 * Each entity maps to a specific node-quickbooks SDK method
 */

export interface EntityMapping {
  name: string;          // Entity name (e.g., 'customer')
  sdkFn: string;         // SDK function name (e.g., 'findCustomers')
  description: string;   // Tool description
}

export const entities: EntityMapping[] = [
  {
    name: 'customer',
    sdkFn: 'findCustomers',
    description: 'List QuickBooks customers'
  },
  {
    name: 'invoice',
    sdkFn: 'findInvoices',
    description: 'List QuickBooks invoices'
  },
  {
    name: 'payment',
    sdkFn: 'findPayments',
    description: 'List QuickBooks payments'
  },
  {
    name: 'transaction',
    sdkFn: 'findPurchases',
    description: 'List QuickBooks transactions (purchases)'
  },
  {
    name: 'vendor',
    sdkFn: 'findVendors',
    description: 'List QuickBooks vendors'
  },
  {
    name: 'item',
    sdkFn: 'findItems',
    description: 'List QuickBooks items (products/services)'
  },
  {
    name: 'account',
    sdkFn: 'findAccounts',
    description: 'List QuickBooks chart of accounts'
  },
  {
    name: 'bill',
    sdkFn: 'findBills',
    description: 'List QuickBooks bills'
  },
  {
    name: 'estimate',
    sdkFn: 'findEstimates',
    description: 'List QuickBooks estimates'
  },
  {
    name: 'employee',
    sdkFn: 'findEmployees',
    description: 'List QuickBooks employees'
  }
];