import { apiRequest } from './api.js';

function toQueryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

// Builds the standard { list, get, create, update, archive, restore } client
// for a Master Data resource, matching the REST conventions used by every
// Phase 1 backend route (contacts, products, accounts, journals, ...).
function createResourceClient(path, listKey) {
  return {
    list: (params) => apiRequest(`${path}${toQueryString(params)}`),
    get: (id) => apiRequest(`${path}/${id}`),
    create: (body) => apiRequest(path, { method: 'POST', body }),
    update: (id, body) => apiRequest(`${path}/${id}`, { method: 'PATCH', body }),
    archive: (id) => apiRequest(`${path}/${id}/archive`, { method: 'POST' }),
    restore: (id) => apiRequest(`${path}/${id}/restore`, { method: 'POST' }),
    listKey,
  };
}

export const contactsApi = createResourceClient('/contacts', 'contacts');
export const productCategoriesApi = createResourceClient('/product-categories', 'categories');
export const productsApi = createResourceClient('/products', 'products');
export const accountsApi = createResourceClient('/accounts', 'accounts');
export const journalsApi = createResourceClient('/journals', 'journals');
export const analyticAccountsApi = createResourceClient('/analytic-accounts', 'analyticAccounts');
export const budgetsApi = createResourceClient('/budgets', 'budgets');

export const journalEntriesApi = {
  list: (params = {}) => apiRequest(`/journal-entries${toQueryString(params)}`),
  get: (id) => apiRequest(`/journal-entries/${id}`),
  create: (body) => apiRequest('/journal-entries', { method: 'POST', body }),
  update: (id, body) => apiRequest(`/journal-entries/${id}`, { method: 'PATCH', body }),
  post: (id) => apiRequest(`/journal-entries/${id}/post`, { method: 'POST' }),
  cancel: (id) => apiRequest(`/journal-entries/${id}/cancel`, { method: 'POST' }),
};

export const accountingApi = {
  balances: (params = {}) => apiRequest(`/accounts/balances${toQueryString(params)}`),
  ledger: (id, params = {}) => apiRequest(`/accounts/${id}/ledger${toQueryString(params)}`),
};

export const purchasesApi = {
  orders: (params = {}) => apiRequest(`/purchases/orders${toQueryString(params)}`),
  order: (id) => apiRequest(`/purchases/orders/${id}`),
  createOrder: (body) => apiRequest('/purchases/orders', { method: 'POST', body }),
  updateOrder: (id, body) => apiRequest(`/purchases/orders/${id}`, { method: 'PATCH', body }),
  confirmOrder: (id) => apiRequest(`/purchases/orders/${id}/confirm`, { method: 'POST' }),
  cancelOrder: (id) => apiRequest(`/purchases/orders/${id}/cancel`, { method: 'POST' }),

  bills: (params = {}) => apiRequest(`/purchases/bills${toQueryString(params)}`),
  bill: (id) => apiRequest(`/purchases/bills/${id}`),
  createBill: (body) => apiRequest('/purchases/bills', { method: 'POST', body }),
  updateBill: (id, body) => apiRequest(`/purchases/bills/${id}`, { method: 'PATCH', body }),
  postBill: (id) => apiRequest(`/purchases/bills/${id}/post`, { method: 'POST' }),
  cancelBill: (id) => apiRequest(`/purchases/bills/${id}/cancel`, { method: 'POST' }),
  billFromOrder: (orderId) => apiRequest(`/purchases/bills/from-order/${orderId}`),

  billOutstanding: (id) => apiRequest(`/purchases/bills/${id}/outstanding`),
  recordBillPayment: (id, body) => apiRequest(`/purchases/bills/${id}/payments`, { method: 'POST', body }),
};

export const salesApi = {
  orders: (params = {}) => apiRequest(`/sales/orders${toQueryString(params)}`),
  order: (id) => apiRequest(`/sales/orders/${id}`),
  createOrder: (body) => apiRequest('/sales/orders', { method: 'POST', body }),
  updateOrder: (id, body) => apiRequest(`/sales/orders/${id}`, { method: 'PATCH', body }),
  confirmOrder: (id) => apiRequest(`/sales/orders/${id}/confirm`, { method: 'POST' }),
  cancelOrder: (id) => apiRequest(`/sales/orders/${id}/cancel`, { method: 'POST' }),

  invoices: (params = {}) => apiRequest(`/sales/invoices${toQueryString(params)}`),
  invoice: (id) => apiRequest(`/sales/invoices/${id}`),
  createInvoice: (body) => apiRequest('/sales/invoices', { method: 'POST', body }),
  updateInvoice: (id, body) => apiRequest(`/sales/invoices/${id}`, { method: 'PATCH', body }),
  postInvoice: (id) => apiRequest(`/sales/invoices/${id}/post`, { method: 'POST' }),
  cancelInvoice: (id) => apiRequest(`/sales/invoices/${id}/cancel`, { method: 'POST' }),
  invoiceFromOrder: (orderId) => apiRequest(`/sales/invoices/from-order/${orderId}`),

  invoiceOutstanding: (id) => apiRequest(`/sales/invoices/${id}/outstanding`),
  recordInvoicePayment: (id, body) => apiRequest(`/sales/invoices/${id}/payments`, { method: 'POST', body }),
};

export const paymentsApi = {
  list: (params = {}) => apiRequest(`/payments${toQueryString(params)}`),
  get: (id) => apiRequest(`/payments/${id}`),
  cancel: (id) => apiRequest(`/payments/${id}/cancel`, { method: 'POST' }),
};

export const inventoryApi = {
  list: (params = {}) => apiRequest(`/inventory${toQueryString(params)}`),
  detail: (id) => apiRequest(`/inventory/${id}`),
  movements: (params = {}) => apiRequest(`/inventory/movements${toQueryString(params)}`),
  productMovements: (id, params = {}) => apiRequest(`/inventory/${id}/movements${toQueryString(params)}`),
  adjust: (body) => apiRequest('/inventory/adjustments', { method: 'POST', body }),
};

export const reportsApi = {
  dashboard: (params = {}) => apiRequest(`/reports/dashboard${toQueryString(params)}`),
  trialBalance: (params = {}) => apiRequest(`/reports/trial-balance${toQueryString(params)}`),
  generalLedger: (params = {}) => apiRequest(`/reports/general-ledger${toQueryString(params)}`),
  profitLoss: (params = {}) => apiRequest(`/reports/profit-loss${toQueryString(params)}`),
  balanceSheet: (params = {}) => apiRequest(`/reports/balance-sheet${toQueryString(params)}`),
  budget: (params = {}) => apiRequest(`/reports/budget${toQueryString(params)}`),
};
export const analyticsApi = {
  dashboard: (params = {}) => apiRequest(`/analytics/dashboard${toQueryString(params)}`),
  sales: (params = {}) => apiRequest(`/analytics/sales${toQueryString(params)}`),
  purchases: (params = {}) => apiRequest(`/analytics/purchases${toQueryString(params)}`),
  inventory: () => apiRequest('/analytics/inventory'),
  receivables: () => apiRequest('/analytics/receivables'), payables: () => apiRequest('/analytics/payables'), cashFlow: (params={}) => apiRequest(`/analytics/cash-flow${toQueryString(params)}`), trends: (params={}) => apiRequest(`/analytics/trends${toQueryString(params)}`),
};

export const adminApi = {
  users: (params={}) => apiRequest(`/admin/users${toQueryString(params)}`),
  updateUser: (id, body) => apiRequest(`/admin/users/${id}`, { method: 'PATCH', body }),
  auditLogs: (params={}) => apiRequest(`/admin/audit-logs${toQueryString(params)}`),
  fiscalPeriods: () => apiRequest('/admin/fiscal-periods'),
  createFiscalPeriod: (body) => apiRequest('/admin/fiscal-periods', { method: 'POST', body }),
  closePeriod: (id) => apiRequest(`/admin/fiscal-periods/${id}/close`, { method: 'POST' }),
  settings: () => apiRequest('/admin/settings'),
  setSetting: (key, value) => apiRequest(`/admin/settings/${key}`, { method: 'PUT', body: { value } }),
  health: () => apiRequest('/admin/system-health'),
  search: (q) => apiRequest(`/search${toQueryString({ q })}`),
  notifications: () => apiRequest('/notifications'),
  taxes: () => apiRequest('/admin/taxes'),
  createTax: (body) => apiRequest('/admin/taxes', { method: 'POST', body }),
  archiveTax: (id) => apiRequest(`/admin/taxes/${id}/archive`, { method: 'POST' }),
};

export function fetchAssignableUsers() {
  return apiRequest('/users/assignable');
}
