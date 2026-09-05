import { apiRequest } from '../lib/api.js';
import { initialMockData } from './mockData.js';
import {
  mapContact,
  mapProduct,
  mapAccount,
  mapJournal,
  mapAnalyticAccount,
  mapBudget,
  mapSalesOrder,
  mapPurchaseOrder,
  mapInvoice,
  mapVendorBill,
  mapPayment,
} from './mappers/index.js';

// Local development storage adapter when backend endpoints are still being built by Member 1 / Member 2
class MockStorageAdapter {
  constructor() {
    this.storageKey = 'urban_furniture_mock_store_v1';
    this.data = this.loadData();
  }

  loadData() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return JSON.parse(JSON.stringify(initialMockData));
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch {
      // ignore
    }
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(initialMockData));
    this.save();
    return this.data;
  }
}

const mockStore = new MockStorageAdapter();

// Helper to attempt backend request first; fallback to mock adapter if 404 or network issue
async function tryApiOrMock(apiCall, mockFallback) {
  try {
    const res = await apiCall();
    return res;
  } catch (err) {
    // If backend returns 404 (route not found) or network error, use isolated development adapter
    const msg = String(err?.message || '');
    if (
      msg.includes('Route not found') ||
      msg.includes('404') ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError')
    ) {
      return await mockFallback();
    }
    throw err;
  }
}

export const api = {
  // -------------------------------------------------------------
  // AUTHENTICATION (Member 1 implemented in Express backend)
  // -------------------------------------------------------------
  auth: {
    async login(credentials) {
      // POST /api/auth/login
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: credentials,
      });
      return data;
    },

    async logout() {
      // POST /api/auth/logout
      return await apiRequest('/auth/logout', { method: 'POST' });
    },

    async me() {
      // GET /api/auth/me
      return await apiRequest('/auth/me');
    },

    async signup(payload) {
      // POST /api/auth/signup
      return await apiRequest('/auth/signup', {
        method: 'POST',
        body: payload,
      });
    },

    async forgotPassword(payload) {
      // POST /api/auth/forgot-password
      return await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: payload,
      });
    },

    async resetPassword(payload) {
      // POST /api/auth/reset-password
      return await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: payload,
      });
    },
  },

  // -------------------------------------------------------------
  // USERS (Member 1 implemented in Express backend)
  // -------------------------------------------------------------
  users: {
    async list() {
      return await apiRequest('/users');
    },

    async approveAccountant(userId) {
      return await apiRequest(`/users/${userId}/approve-accountant`, {
        method: 'POST',
      });
    },

    async create(payload) {
      return await apiRequest('/users', {
        method: 'POST',
        body: payload,
      });
    },
  },

  // -------------------------------------------------------------
  // CONTACTS (Customers & Vendors)
  // -------------------------------------------------------------
  contacts: {
    async list(typeFilter) {
      return tryApiOrMock(
        async () => {
          const query = typeFilter ? `?type=${typeFilter}` : '';
          const data = await apiRequest(`/contacts${query}`);
          const rawList = data.contacts || data || [];
          return rawList.map(mapContact);
        },
        async () => {
          let list = mockStore.data.contacts;
          if (typeFilter && typeFilter !== 'ALL') {
            list = list.filter((c) => c.type === typeFilter);
          }
          return list.map(mapContact);
        }
      );
    },

    async get(id) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/contacts/${id}`);
          return mapContact(data.contact || data);
        },
        async () => {
          const found = mockStore.data.contacts.find((c) => c.id === id);
          if (!found) throw new Error('Contact not found');
          return mapContact(found);
        }
      );
    },

    async create(contactData) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/contacts', {
            method: 'POST',
            body: contactData,
          });
          return mapContact(data.contact || data);
        },
        async () => {
          const newContact = {
            id: `cnt-${Date.now()}`,
            name: contactData.name,
            type: contactData.type || 'CUSTOMER',
            email: contactData.email || '',
            phone: contactData.phone || '',
            city: contactData.city || '',
            taxId: contactData.taxId || '',
            paymentTerms: contactData.paymentTerms || '30 Days',
            balance: 0,
            status: 'ACTIVE',
          };
          mockStore.data.contacts.unshift(newContact);
          mockStore.save();
          return mapContact(newContact);
        }
      );
    },

    async update(id, contactData) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/contacts/${id}`, {
            method: 'PUT',
            body: contactData,
          });
          return mapContact(data.contact || data);
        },
        async () => {
          const idx = mockStore.data.contacts.findIndex((c) => c.id === id);
          if (idx === -1) throw new Error('Contact not found');
          mockStore.data.contacts[idx] = {
            ...mockStore.data.contacts[idx],
            ...contactData,
          };
          mockStore.save();
          return mapContact(mockStore.data.contacts[idx]);
        }
      );
    },

    async delete(id) {
      return tryApiOrMock(
        async () => {
          return await apiRequest(`/contacts/${id}`, { method: 'DELETE' });
        },
        async () => {
          mockStore.data.contacts = mockStore.data.contacts.filter((c) => c.id !== id);
          mockStore.save();
          return { success: true };
        }
      );
    },
  },

  // -------------------------------------------------------------
  // PRODUCTS
  // -------------------------------------------------------------
  products: {
    async list() {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/products');
          const list = data.products || data || [];
          return list.map(mapProduct);
        },
        async () => {
          return mockStore.data.products.map(mapProduct);
        }
      );
    },

    async get(id) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/products/${id}`);
          return mapProduct(data.product || data);
        },
        async () => {
          const found = mockStore.data.products.find((p) => p.id === id);
          if (!found) throw new Error('Product not found');
          return mapProduct(found);
        }
      );
    },

    async create(productData) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/products', {
            method: 'POST',
            body: productData,
          });
          return mapProduct(data.product || data);
        },
        async () => {
          const newProduct = {
            id: `prd-${Date.now()}`,
            name: productData.name,
            sku: productData.sku || `SKU-${Date.now().toString().slice(-4)}`,
            category: productData.category || 'Furniture',
            salesPrice: Number(productData.salesPrice || 0),
            costPrice: Number(productData.costPrice || 0),
            taxPercent: Number(productData.taxPercent || 10),
            stockQuantity: Number(productData.stockQuantity || 0),
            uom: productData.uom || 'Units',
            status: 'ACTIVE',
          };
          mockStore.data.products.unshift(newProduct);
          mockStore.save();
          return mapProduct(newProduct);
        }
      );
    },

    async update(id, productData) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/products/${id}`, {
            method: 'PUT',
            body: productData,
          });
          return mapProduct(data.product || data);
        },
        async () => {
          const idx = mockStore.data.products.findIndex((p) => p.id === id);
          if (idx === -1) throw new Error('Product not found');
          mockStore.data.products[idx] = {
            ...mockStore.data.products[idx],
            ...productData,
          };
          mockStore.save();
          return mapProduct(mockStore.data.products[idx]);
        }
      );
    },

    async delete(id) {
      return tryApiOrMock(
        async () => {
          return await apiRequest(`/products/${id}`, { method: 'DELETE' });
        },
        async () => {
          mockStore.data.products = mockStore.data.products.filter((p) => p.id !== id);
          mockStore.save();
          return { success: true };
        }
      );
    },
  },

  // -------------------------------------------------------------
  // ACCOUNTS (Chart of Accounts)
  // -------------------------------------------------------------
  accounts: {
    async list() {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/accounts');
          const list = data.accounts || data || [];
          return list.map(mapAccount);
        },
        async () => {
          return mockStore.data.accounts.map(mapAccount);
        }
      );
    },

    async create(accountData) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/accounts', {
            method: 'POST',
            body: accountData,
          });
          return mapAccount(data.account || data);
        },
        async () => {
          const newAccount = {
            id: `acc-${Date.now()}`,
            code: accountData.code,
            name: accountData.name,
            type: (accountData.type || 'ASSET').toUpperCase(),
            currency: accountData.currency || 'USD',
            balance: Number(accountData.balance || 0),
            reconcilable: Boolean(accountData.reconcilable ?? true),
            status: 'ACTIVE',
          };
          mockStore.data.accounts.push(newAccount);
          mockStore.save();
          return mapAccount(newAccount);
        }
      );
    },

    async update(id, accountData) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/accounts/${id}`, {
            method: 'PUT',
            body: accountData,
          });
          return mapAccount(data.account || data);
        },
        async () => {
          const idx = mockStore.data.accounts.findIndex((a) => a.id === id);
          if (idx === -1) throw new Error('Account not found');
          mockStore.data.accounts[idx] = {
            ...mockStore.data.accounts[idx],
            ...accountData,
          };
          mockStore.save();
          return mapAccount(mockStore.data.accounts[idx]);
        }
      );
    },

    async delete(id) {
      return tryApiOrMock(
        async () => {
          return await apiRequest(`/accounts/${id}`, { method: 'DELETE' });
        },
        async () => {
          mockStore.data.accounts = mockStore.data.accounts.filter((a) => a.id !== id);
          mockStore.save();
          return { success: true };
        }
      );
    },
  },

  // -------------------------------------------------------------
  // JOURNALS
  // -------------------------------------------------------------
  journals: {
    async list() {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/journals');
          const list = data.journals || data || [];
          return list.map(mapJournal);
        },
        async () => {
          return mockStore.data.journals.map(mapJournal);
        }
      );
    },

    async create(journalData) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/journals', {
            method: 'POST',
            body: journalData,
          });
          return mapJournal(data.journal || data);
        },
        async () => {
          const newJournal = {
            id: `jnl-${Date.now()}`,
            name: journalData.name,
            code: journalData.code,
            type: journalData.type,
            defaultAccount: journalData.defaultAccount || '',
            shortCode: journalData.shortCode || journalData.code,
          };
          mockStore.data.journals.push(newJournal);
          mockStore.save();
          return mapJournal(newJournal);
        }
      );
    },

    async update(id, journalData) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/journals/${id}`, {
            method: 'PUT',
            body: journalData,
          });
          return mapJournal(data.journal || data);
        },
        async () => {
          const idx = mockStore.data.journals.findIndex((j) => j.id === id);
          if (idx === -1) throw new Error('Journal not found');
          mockStore.data.journals[idx] = {
            ...mockStore.data.journals[idx],
            ...journalData,
          };
          mockStore.save();
          return mapJournal(mockStore.data.journals[idx]);
        }
      );
    },
  },

  // -------------------------------------------------------------
  // ANALYTIC ACCOUNTS (Cost Centers / Projects)
  // -------------------------------------------------------------
  analyticAccounts: {
    async list() {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/analytic-accounts');
          const list = data.analyticAccounts || data || [];
          return list.map(mapAnalyticAccount);
        },
        async () => {
          return mockStore.data.analyticAccounts.map(mapAnalyticAccount);
        }
      );
    },

    async create(data) {
      return tryApiOrMock(
        async () => {
          const res = await apiRequest('/analytic-accounts', {
            method: 'POST',
            body: data,
          });
          return mapAnalyticAccount(res.analyticAccount || res);
        },
        async () => {
          const newItem = {
            id: `ana-${Date.now()}`,
            name: data.name,
            code: data.code || `AA-${Date.now().toString().slice(-4)}`,
            partner: data.partner || 'Internal',
            budget: Number(data.budget || 0),
            spent: 0,
            status: 'ACTIVE',
          };
          mockStore.data.analyticAccounts.push(newItem);
          mockStore.save();
          return mapAnalyticAccount(newItem);
        }
      );
    },

    async update(id, data) {
      return tryApiOrMock(
        async () => {
          const res = await apiRequest(`/analytic-accounts/${id}`, {
            method: 'PUT',
            body: data,
          });
          return mapAnalyticAccount(res.analyticAccount || res);
        },
        async () => {
          const idx = mockStore.data.analyticAccounts.findIndex((a) => a.id === id);
          if (idx === -1) throw new Error('Analytic account not found');
          mockStore.data.analyticAccounts[idx] = {
            ...mockStore.data.analyticAccounts[idx],
            ...data,
          };
          mockStore.save();
          return mapAnalyticAccount(mockStore.data.analyticAccounts[idx]);
        }
      );
    },
  },

  // -------------------------------------------------------------
  // BUDGETS
  // -------------------------------------------------------------
  budgets: {
    async list() {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/budgets');
          const list = data.budgets || data || [];
          return list.map(mapBudget);
        },
        async () => {
          return mockStore.data.budgets.map(mapBudget);
        }
      );
    },

    async create(budgetData) {
      return tryApiOrMock(
        async () => {
          const res = await apiRequest('/budgets', {
            method: 'POST',
            body: budgetData,
          });
          return mapBudget(res.budget || res);
        },
        async () => {
          const lines = (budgetData.lines || []).map((l, i) => ({
            id: `line-${Date.now()}-${i}`,
            name: l.name,
            account: l.account,
            plannedAmount: Number(l.plannedAmount || 0),
            practicalAmount: Number(l.practicalAmount || 0),
          }));
          const totalPlanned = lines.reduce((acc, l) => acc + l.plannedAmount, 0);
          const totalPractical = lines.reduce((acc, l) => acc + l.practicalAmount, 0);
          const newBudget = {
            id: `bdg-${Date.now()}`,
            name: budgetData.name,
            dateFrom: budgetData.dateFrom,
            dateTo: budgetData.dateTo,
            totalPlanned,
            totalPractical,
            lines,
          };
          mockStore.data.budgets.unshift(newBudget);
          mockStore.save();
          return mapBudget(newBudget);
        }
      );
    },

    async update(id, budgetData) {
      return tryApiOrMock(
        async () => {
          const res = await apiRequest(`/budgets/${id}`, {
            method: 'PUT',
            body: budgetData,
          });
          return mapBudget(res.budget || res);
        },
        async () => {
          const idx = mockStore.data.budgets.findIndex((b) => b.id === id);
          if (idx === -1) throw new Error('Budget not found');
          const updated = { ...mockStore.data.budgets[idx], ...budgetData };
          mockStore.data.budgets[idx] = updated;
          mockStore.save();
          return mapBudget(updated);
        }
      );
    },
  },

  // -------------------------------------------------------------
  // SALES ORDERS (/api/sales-orders)
  // -------------------------------------------------------------
  salesOrders: {
    async list() {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/sales-orders');
          const list = data.salesOrders || data || [];
          return list.map(mapSalesOrder);
        },
        async () => {
          return mockStore.data.salesOrders.map(mapSalesOrder);
        }
      );
    },

    async get(id) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/sales-orders/${id}`);
          return mapSalesOrder(data.salesOrder || data);
        },
        async () => {
          const found = mockStore.data.salesOrders.find((s) => s.id === id);
          if (!found) throw new Error('Sales order not found');
          return mapSalesOrder(found);
        }
      );
    },

    async create(orderData) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/sales-orders', {
            method: 'POST',
            body: orderData,
          });
          return mapSalesOrder(data.salesOrder || data);
        },
        async () => {
          const subtotal = (orderData.items || []).reduce(
            (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
            0
          );
          const tax = subtotal * 0.1;
          const total = subtotal + tax;
          const newOrder = {
            id: `so-${Date.now()}`,
            orderNumber: `SO/2026/${String(mockStore.data.salesOrders.length + 1).padStart(4, '0')}`,
            customerId: orderData.customerId,
            customerName: orderData.customerName || 'Customer',
            orderDate: orderData.orderDate || new Date().toISOString().split('T')[0],
            status: orderData.status || 'QUOTATION',
            invoiceStatus: 'NOTHING TO INVOICE',
            paymentTerms: orderData.paymentTerms || '30 Days',
            items: orderData.items || [],
            subtotal,
            tax,
            total,
          };
          mockStore.data.salesOrders.unshift(newOrder);
          mockStore.save();
          return mapSalesOrder(newOrder);
        }
      );
    },

    async confirm(id) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/sales-orders/${id}/confirm`, {
            method: 'POST',
          });
          return mapSalesOrder(data.salesOrder || data);
        },
        async () => {
          const idx = mockStore.data.salesOrders.findIndex((s) => s.id === id);
          if (idx === -1) throw new Error('Sales order not found');
          mockStore.data.salesOrders[idx].status = 'CONFIRMED';
          mockStore.data.salesOrders[idx].invoiceStatus = 'TO INVOICE';
          mockStore.save();
          return mapSalesOrder(mockStore.data.salesOrders[idx]);
        }
      );
    },

    async createInvoice(id) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/sales-orders/${id}/create-invoice`, {
            method: 'POST',
          });
          return mapInvoice(data.invoice || data);
        },
        async () => {
          const order = mockStore.data.salesOrders.find((s) => s.id === id);
          if (!order) throw new Error('Sales order not found');
          order.invoiceStatus = 'FULLY INVOICED';

          const newInvoice = {
            id: `inv-${Date.now()}`,
            invoiceNumber: `INV/2026/${String(mockStore.data.invoices.length + 1).padStart(4, '0')}`,
            salesOrderId: order.id,
            customerId: order.customerId,
            customerName: order.customerName,
            invoiceDate: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            paymentTerms: order.paymentTerms || '30 Days',
            status: 'POSTED',
            items: order.items,
            subtotal: order.subtotal,
            tax: order.tax,
            total: order.total,
            paid: 0,
            outstanding: order.total,
          };
          mockStore.data.invoices.unshift(newInvoice);
          mockStore.save();
          return mapInvoice(newInvoice);
        }
      );
    },
  },

  // -------------------------------------------------------------
  // PURCHASE ORDERS (/api/purchase-orders)
  // -------------------------------------------------------------
  purchaseOrders: {
    async list() {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/purchase-orders');
          const list = data.purchaseOrders || data || [];
          return list.map(mapPurchaseOrder);
        },
        async () => {
          return mockStore.data.purchaseOrders.map(mapPurchaseOrder);
        }
      );
    },

    async get(id) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/purchase-orders/${id}`);
          return mapPurchaseOrder(data.purchaseOrder || data);
        },
        async () => {
          const found = mockStore.data.purchaseOrders.find((p) => p.id === id);
          if (!found) throw new Error('Purchase order not found');
          return mapPurchaseOrder(found);
        }
      );
    },

    async create(orderData) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/purchase-orders', {
            method: 'POST',
            body: orderData,
          });
          return mapPurchaseOrder(data.purchaseOrder || data);
        },
        async () => {
          const subtotal = (orderData.items || []).reduce(
            (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
            0
          );
          const tax = 0;
          const total = subtotal;
          const newOrder = {
            id: `po-${Date.now()}`,
            orderNumber: `PO/2026/${String(mockStore.data.purchaseOrders.length + 1).padStart(4, '0')}`,
            vendorId: orderData.vendorId,
            vendorName: orderData.vendorName || 'Vendor',
            orderDate: orderData.orderDate || new Date().toISOString().split('T')[0],
            status: orderData.status || 'RFQ',
            billStatus: 'NOTHING TO BILL',
            paymentTerms: orderData.paymentTerms || '30 Days',
            items: orderData.items || [],
            subtotal,
            tax,
            total,
          };
          mockStore.data.purchaseOrders.unshift(newOrder);
          mockStore.save();
          return mapPurchaseOrder(newOrder);
        }
      );
    },

    async confirm(id) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/purchase-orders/${id}/confirm`, {
            method: 'POST',
          });
          return mapPurchaseOrder(data.purchaseOrder || data);
        },
        async () => {
          const idx = mockStore.data.purchaseOrders.findIndex((p) => p.id === id);
          if (idx === -1) throw new Error('Purchase order not found');
          mockStore.data.purchaseOrders[idx].status = 'PURCHASE ORDER';
          mockStore.data.purchaseOrders[idx].billStatus = 'WAITING BILLS';
          mockStore.save();
          return mapPurchaseOrder(mockStore.data.purchaseOrders[idx]);
        }
      );
    },

    async convertToBill(id) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/purchase-orders/${id}/convert-to-bill`, {
            method: 'POST',
          });
          return mapVendorBill(data.vendorBill || data.bill || data);
        },
        async () => {
          const po = mockStore.data.purchaseOrders.find((p) => p.id === id);
          if (!po) throw new Error('Purchase order not found');
          po.billStatus = 'FULLY BILLED';

          const newBill = {
            id: `bill-${Date.now()}`,
            billNumber: `BILL/2026/${String(mockStore.data.vendorBills.length + 1).padStart(4, '0')}`,
            purchaseOrderId: po.id,
            vendorId: po.vendorId,
            vendorName: po.vendorName,
            billDate: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            paymentTerms: po.paymentTerms || '30 Days',
            status: 'POSTED',
            items: po.items,
            subtotal: po.subtotal,
            tax: po.tax,
            total: po.total,
            paid: 0,
            outstanding: po.total,
          };
          mockStore.data.vendorBills.unshift(newBill);
          mockStore.save();
          return mapVendorBill(newBill);
        }
      );
    },
  },

  // -------------------------------------------------------------
  // INVOICES (/api/invoices)
  // -------------------------------------------------------------
  invoices: {
    async list() {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/invoices');
          const list = data.invoices || data || [];
          return list.map(mapInvoice);
        },
        async () => {
          return mockStore.data.invoices.map(mapInvoice);
        }
      );
    },

    async get(id) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/invoices/${id}`);
          return mapInvoice(data.invoice || data);
        },
        async () => {
          const found = mockStore.data.invoices.find((i) => i.id === id);
          if (!found) throw new Error('Invoice not found');
          return mapInvoice(found);
        }
      );
    },

    async create(invoiceData) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/invoices', {
            method: 'POST',
            body: invoiceData,
          });
          return mapInvoice(data.invoice || data);
        },
        async () => {
          const subtotal = (invoiceData.items || []).reduce(
            (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
            0
          );
          const tax = subtotal * 0.1;
          const total = subtotal + tax;
          const newInvoice = {
            id: `inv-${Date.now()}`,
            invoiceNumber: `INV/2026/${String(mockStore.data.invoices.length + 1).padStart(4, '0')}`,
            salesOrderId: invoiceData.salesOrderId || null,
            customerId: invoiceData.customerId,
            customerName: invoiceData.customerName || 'Customer',
            invoiceDate: invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
            dueDate: invoiceData.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            paymentTerms: invoiceData.paymentTerms || '30 Days',
            status: 'DRAFT',
            items: invoiceData.items || [],
            subtotal,
            tax,
            total,
            paid: 0,
            outstanding: total,
          };
          mockStore.data.invoices.unshift(newInvoice);
          mockStore.save();
          return mapInvoice(newInvoice);
        }
      );
    },

    async post(id) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/invoices/${id}/post`, { method: 'POST' });
          return mapInvoice(data.invoice || data);
        },
        async () => {
          const idx = mockStore.data.invoices.findIndex((i) => i.id === id);
          if (idx === -1) throw new Error('Invoice not found');
          mockStore.data.invoices[idx].status = 'POSTED';
          mockStore.save();
          return mapInvoice(mockStore.data.invoices[idx]);
        }
      );
    },
  },

  // -------------------------------------------------------------
  // VENDOR BILLS (/api/vendor-bills)
  // -------------------------------------------------------------
  vendorBills: {
    async list() {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/vendor-bills');
          const list = data.vendorBills || data.bills || data || [];
          return list.map(mapVendorBill);
        },
        async () => {
          return mockStore.data.vendorBills.map(mapVendorBill);
        }
      );
    },

    async get(id) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/vendor-bills/${id}`);
          return mapVendorBill(data.vendorBill || data.bill || data);
        },
        async () => {
          const found = mockStore.data.vendorBills.find((b) => b.id === id);
          if (!found) throw new Error('Vendor bill not found');
          return mapVendorBill(found);
        }
      );
    },

    async create(billData) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/vendor-bills', {
            method: 'POST',
            body: billData,
          });
          return mapVendorBill(data.vendorBill || data.bill || data);
        },
        async () => {
          const subtotal = (billData.items || []).reduce(
            (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
            0
          );
          const tax = 0;
          const total = subtotal;
          const newBill = {
            id: `bill-${Date.now()}`,
            billNumber: `BILL/2026/${String(mockStore.data.vendorBills.length + 1).padStart(4, '0')}`,
            purchaseOrderId: billData.purchaseOrderId || null,
            vendorId: billData.vendorId,
            vendorName: billData.vendorName || 'Vendor',
            billDate: billData.billDate || new Date().toISOString().split('T')[0],
            dueDate: billData.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            paymentTerms: billData.paymentTerms || '30 Days',
            status: 'DRAFT',
            items: billData.items || [],
            subtotal,
            tax,
            total,
            paid: 0,
            outstanding: total,
          };
          mockStore.data.vendorBills.unshift(newBill);
          mockStore.save();
          return mapVendorBill(newBill);
        }
      );
    },

    async post(id) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest(`/vendor-bills/${id}/post`, { method: 'POST' });
          return mapVendorBill(data.vendorBill || data.bill || data);
        },
        async () => {
          const idx = mockStore.data.vendorBills.findIndex((b) => b.id === id);
          if (idx === -1) throw new Error('Vendor bill not found');
          mockStore.data.vendorBills[idx].status = 'POSTED';
          mockStore.save();
          return mapVendorBill(mockStore.data.vendorBills[idx]);
        }
      );
    },
  },

  // -------------------------------------------------------------
  // PAYMENTS (/api/payments)
  // -------------------------------------------------------------
  payments: {
    async list() {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/payments');
          const list = data.payments || data || [];
          return list.map(mapPayment);
        },
        async () => {
          return mockStore.data.payments.map(mapPayment);
        }
      );
    },

    async create(paymentPayload) {
      return tryApiOrMock(
        async () => {
          const data = await apiRequest('/payments', {
            method: 'POST',
            body: paymentPayload,
          });
          return mapPayment(data.payment || data);
        },
        async () => {
          const amount = Number(paymentPayload.amount || 0);
          if (amount <= 0) throw new Error('Payment amount must be greater than zero.');

          const isInvoice = paymentPayload.targetType === 'INVOICE';
          let targetNumber = '';
          let partnerName = '';

          if (isInvoice) {
            const inv = mockStore.data.invoices.find((i) => i.id === paymentPayload.targetId);
            if (!inv) throw new Error('Target invoice not found.');
            if (amount > inv.outstanding) {
              throw new Error(`Amount cannot exceed outstanding balance of $${inv.outstanding.toFixed(2)}.`);
            }
            inv.paid += amount;
            inv.outstanding = Math.max(0, inv.total - inv.paid);
            inv.status = inv.outstanding === 0 ? 'PAID' : 'PARTIALLY_PAID';
            targetNumber = inv.invoiceNumber;
            partnerName = inv.customerName;
          } else {
            const bill = mockStore.data.vendorBills.find((b) => b.id === paymentPayload.targetId);
            if (!bill) throw new Error('Target vendor bill not found.');
            if (amount > bill.outstanding) {
              throw new Error(`Amount cannot exceed outstanding balance of $${bill.outstanding.toFixed(2)}.`);
            }
            bill.paid += amount;
            bill.outstanding = Math.max(0, bill.total - bill.paid);
            bill.status = bill.outstanding === 0 ? 'PAID' : 'PARTIALLY_PAID';
            targetNumber = bill.billNumber;
            partnerName = bill.vendorName;
          }

          const newPayment = {
            id: `pay-${Date.now()}`,
            paymentNumber: `PAY/2026/${String(mockStore.data.payments.length + 1).padStart(4, '0')}`,
            type: isInvoice ? 'INBOUND' : 'OUTBOUND',
            targetType: paymentPayload.targetType,
            targetId: paymentPayload.targetId,
            targetNumber,
            partnerName,
            amount,
            method: paymentPayload.method || 'Bank',
            journalId: paymentPayload.journalId || (paymentPayload.method === 'Cash' ? 'jnl-4' : 'jnl-3'),
            journalName: paymentPayload.method === 'Cash' ? 'Cash Register Drawer' : 'Chase Operating Bank',
            date: paymentPayload.date || new Date().toISOString().split('T')[0],
            memo: paymentPayload.memo || `Payment for ${targetNumber}`,
          };

          mockStore.data.payments.unshift(newPayment);
          mockStore.save();
          return mapPayment(newPayment);
        }
      );
    },
  },

  // -------------------------------------------------------------
  // FINANCIAL REPORTS & DASHBOARD
  // -------------------------------------------------------------
  reports: {
    async getDashboardMetrics() {
      return tryApiOrMock(
        async () => {
          return await apiRequest('/reports/dashboard');
        },
        async () => {
          // Calculate real metrics dynamically from store
          const salesTotal = mockStore.data.salesOrders
            .filter((s) => s.status !== 'CANCELLED')
            .reduce((sum, s) => sum + s.total, 0);

          const purchasesTotal = mockStore.data.purchaseOrders
            .filter((p) => p.status !== 'CANCELLED')
            .reduce((sum, p) => sum + p.total, 0);

          const receivables = mockStore.data.invoices
            .filter((i) => i.status !== 'CANCELLED')
            .reduce((sum, i) => sum + i.outstanding, 0);

          const payables = mockStore.data.vendorBills
            .filter((b) => b.status !== 'CANCELLED')
            .reduce((sum, b) => sum + b.outstanding, 0);

          const bankAccount = mockStore.data.accounts.find((a) => a.code === '102000');
          const cashAccount = mockStore.data.accounts.find((a) => a.code === '101000');
          const cashBankBalance = (bankAccount?.balance || 0) + (cashAccount?.balance || 0);

          const netProfit = salesTotal - purchasesTotal;

          const totalPlannedBudget = mockStore.data.budgets.reduce(
            (sum, b) => sum + b.totalPlanned,
            0
          );
          const totalPracticalBudget = mockStore.data.budgets.reduce(
            (sum, b) => sum + b.totalPractical,
            0
          );
          const budgetUtilization =
            totalPlannedBudget > 0
              ? Math.round((totalPracticalBudget / totalPlannedBudget) * 100)
              : 0;

          return {
            totalSales: salesTotal,
            totalPurchases: purchasesTotal,
            receivables,
            payables,
            cashBankBalance,
            netProfit,
            budgetUtilization,
            totalPlannedBudget,
            totalPracticalBudget,
            revenueMonthly: [
              { month: 'Oct', sales: 42000, purchases: 26000 },
              { month: 'Nov', sales: 51000, purchases: 32000 },
              { month: 'Dec', sales: 68000, purchases: 41000 },
              { month: 'Jan', sales: 48000, purchases: 29000 },
              { month: 'Feb', sales: 58000, purchases: 34000 },
              { month: 'Mar', sales: salesTotal > 0 ? salesTotal : 64000, purchases: purchasesTotal > 0 ? purchasesTotal : 38000 },
            ],
          };
        }
      );
    },

    async getBalanceSheet(asOfDate) {
      return tryApiOrMock(
        async () => {
          const query = asOfDate ? `?asOf=${asOfDate}` : '';
          return await apiRequest(`/reports/balance-sheet${query}`);
        },
        async () => {
          const assets = [
            { code: '101000', name: 'Cash on Hand', amount: 18450.0 },
            { code: '102000', name: 'Operating Bank Account (Chase)', amount: 124800.0 },
            { code: '120000', name: 'Accounts Receivable (Debtors)', amount: 46200.0 },
            { code: '130000', name: 'Furniture Inventory', amount: 68400.0 },
            { code: '150000', name: 'Office Equipment & Fixtures', amount: 185000.0 },
          ];

          const liabilities = [
            { code: '200000', name: 'Accounts Payable (Creditors)', amount: 29650.0 },
            { code: '220000', name: 'Sales Tax Payable', amount: 6800.0 },
            { code: '250000', name: 'Commercial Bank Loan', amount: 50000.0 },
          ];

          const equity = [
            { code: '300000', name: "Common Stock & Owner's Capital", amount: 200000.0 },
            { code: '320000', name: 'Retained Earnings', amount: 95000.0 },
            { code: '399999', name: 'Current Year Earnings (Net Profit)', amount: 61400.0 },
          ];

          const totalAssets = assets.reduce((sum, item) => sum + item.amount, 0);
          const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0);
          const totalEquity = equity.reduce((sum, item) => sum + item.amount, 0);

          return {
            asOfDate: asOfDate || new Date().toISOString().split('T')[0],
            currency: 'USD',
            assets,
            totalAssets,
            liabilities,
            totalLiabilities,
            equity,
            totalEquity,
            totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
            isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
          };
        }
      );
    },

    async getProfitLoss(period) {
      return tryApiOrMock(
        async () => {
          const query = period ? `?period=${period}` : '';
          return await apiRequest(`/reports/profit-loss${query}`);
        },
        async () => {
          const income = [
            { code: '400000', name: 'Commercial Furniture Sales', amount: 182400.0 },
            { code: '410000', name: 'Assembly & Interior Installation Services', amount: 24500.0 },
          ];
          const totalIncome = income.reduce((s, i) => s + i.amount, 0);

          const cogs = [
            { code: '500000', name: 'Direct Material (Hardwood & Metals)', amount: 76000.0 },
            { code: '510000', name: 'Direct Freight & Import Duties', amount: 18500.0 },
          ];
          const totalCogs = cogs.reduce((s, c) => s + c.amount, 0);
          const grossProfit = totalIncome - totalCogs;

          const expenses = [
            { code: '600000', name: 'Showroom & Office Rent', amount: 18000.0 },
            { code: '610000', name: 'Staff Salaries & Benefits', amount: 34500.0 },
            { code: '620000', name: 'Utilities & Internet', amount: 3200.0 },
            { code: '630000', name: 'Digital Marketing & Showroom Ads', amount: 5800.0 },
            { code: '640000', name: 'Depreciation - Equipment', amount: 6000.0 },
          ];
          const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
          const netProfit = grossProfit - totalExpenses;

          return {
            period: period || 'Year to Date 2026',
            currency: 'USD',
            income,
            totalIncome,
            cogs,
            totalCogs,
            grossProfit,
            expenses,
            totalExpenses,
            netProfit,
            netProfitMargin: Math.round((netProfit / totalIncome) * 100 * 10) / 10,
          };
        }
      );
    },

    async getBudgetReport(budgetId) {
      return tryApiOrMock(
        async () => {
          const query = budgetId ? `?budgetId=${budgetId}` : '';
          return await apiRequest(`/reports/budget${query}`);
        },
        async () => {
          const budget =
            mockStore.data.budgets.find((b) => b.id === budgetId) ||
            mockStore.data.budgets[0];

          if (!budget) return null;

          const lines = budget.lines.map((line) => {
            const remaining = line.plannedAmount - line.practicalAmount;
            const utilization =
              line.plannedAmount > 0
                ? Math.round((line.practicalAmount / line.plannedAmount) * 100)
                : 0;
            return {
              ...line,
              remaining,
              utilization,
            };
          });

          const totalPlanned = lines.reduce((s, l) => s + l.plannedAmount, 0);
          const totalPractical = lines.reduce((s, l) => s + l.practicalAmount, 0);
          const totalRemaining = totalPlanned - totalPractical;
          const overallUtilization =
            totalPlanned > 0 ? Math.round((totalPractical / totalPlanned) * 100) : 0;

          return {
            id: budget.id,
            name: budget.name,
            dateFrom: budget.dateFrom,
            dateTo: budget.dateTo,
            lines,
            totalPlanned,
            totalPractical,
            totalRemaining,
            overallUtilization,
          };
        }
      );
    },
  },
};
