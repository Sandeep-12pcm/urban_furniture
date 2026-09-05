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
  orders: () => apiRequest('/purchases/orders'), order: (id) => apiRequest(`/purchases/orders/${id}`), createOrder: (body) => apiRequest('/purchases/orders', { method: 'POST', body }), confirmOrder: (id) => apiRequest(`/purchases/orders/${id}/confirm`, { method: 'POST' }), cancelOrder: (id) => apiRequest(`/purchases/orders/${id}/cancel`, { method: 'POST' }),
  bills: () => apiRequest('/purchases/bills'), bill: (id) => apiRequest(`/purchases/bills/${id}`), createBill: (body) => apiRequest('/purchases/bills', { method: 'POST', body }), postBill: (id) => apiRequest(`/purchases/bills/${id}/post`, { method: 'POST' }), cancelBill: (id) => apiRequest(`/purchases/bills/${id}/cancel`, { method: 'POST' }), billFromOrder: (id) => apiRequest(`/purchases/bills/from-order/${id}`),
};
export const salesApi = {
  orders: () => apiRequest('/sales/orders'),
  invoices: () => apiRequest('/sales/invoices'),
};

export function fetchAssignableUsers() {
  return apiRequest('/users/assignable');
}
