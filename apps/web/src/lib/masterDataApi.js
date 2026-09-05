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

export function fetchAssignableUsers() {
  return apiRequest('/users/assignable');
}
