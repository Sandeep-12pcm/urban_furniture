// Standard Master Data CRUD + archive/restore path documentation, shared by
// every Phase 1 resource. ADMIN and ACCOUNTANT can create/view/update;
// ADMIN alone may archive/restore. CONTACT and unauthenticated callers are
// rejected by the authenticate()/authorize() middleware (401/403).
function masterDataPaths(resource, { singular, description }) {
  return {
    [`/${resource}`]: {
      get: {
        summary: `List ${description} (search, filter, paginate)`,
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'OK' },
          401: { description: 'Authentication required.' },
          403: { description: 'ADMIN or ACCOUNTANT role required.' },
        },
      },
      post: {
        summary: `Create a ${singular}`,
        security: [{ cookieAuth: [] }],
        responses: {
          201: { description: 'Created' },
          400: { description: 'Validation error or duplicate value.' },
          401: { description: 'Authentication required.' },
          403: { description: 'ADMIN or ACCOUNTANT role required.' },
        },
      },
    },
    [`/${resource}/{id}`]: {
      get: {
        summary: `Get a ${singular} by id`,
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not found.' } },
      },
      patch: {
        summary: `Update a ${singular}`,
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Updated' },
          400: { description: 'Validation error or duplicate value.' },
          404: { description: 'Not found.' },
        },
      },
    },
    [`/${resource}/{id}/archive`]: {
      post: {
        summary: `Archive a ${singular} (ADMIN only, reversible)`,
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Archived' },
          400: { description: 'Already archived, or still referenced by other active records.' },
          403: { description: 'ADMIN role required.' },
          404: { description: 'Not found.' },
        },
      },
    },
    [`/${resource}/{id}/restore`]: {
      post: {
        summary: `Restore an archived ${singular} (ADMIN only)`,
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Restored' },
          400: { description: 'Not archived, or a dependency is still archived.' },
          403: { description: 'ADMIN role required.' },
          404: { description: 'Not found.' },
        },
      },
    },
  };
}

const openApiDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Urban Furniture Accounting API',
    version: '0.5.0',
    description: 'Express REST API for JWT authentication/RBAC through Financial Reporting (Phase 7).',
  },
  servers: [{ url: 'http://localhost:4000/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' },
    },
  },
  paths: {
    '/auth/login': { post: { summary: 'Login and receive an HTTP-only JWT cookie' } },
    '/auth/logout': { post: { summary: 'Logout and clear JWT cookie', security: [{ cookieAuth: [] }] } },
    '/auth/me': { get: { summary: 'Get current user', security: [{ cookieAuth: [] }] } },
    '/auth/signup': { post: { summary: 'Signup for pending Accountant access or active Customer/Vendor access' } },
    '/auth/forgot-password': { post: { summary: 'Request password reset without account enumeration' } },
    '/auth/reset-password': { post: { summary: 'Reset password with expiring token' } },
    '/users': {
      get: { summary: 'Scoped account list by role', security: [{ cookieAuth: [] }] },
      post: { summary: 'Admin-only fallback creation of ACCOUNTANT or CONTACT users', security: [{ cookieAuth: [] }] },
    },
    '/users/assignable': {
      get: { summary: 'Active ADMIN/ACCOUNTANT users for Master Data pickers (e.g. Budget responsible person)', security: [{ cookieAuth: [] }] },
    },
    '/users/{id}/approve-accountant': {
      post: { summary: 'Admin-only approval for pending Accountant accounts', security: [{ cookieAuth: [] }] },
    },
    '/admin/health': { get: { summary: 'Admin-only protected route', security: [{ cookieAuth: [] }] } },
    '/contact/portal': { get: { summary: 'Contact-only protected route', security: [{ cookieAuth: [] }] } },

    // POST /contacts also accepts { createPortalAccount: true, portalAccount: {...} }
    // to create a linked CONTACT-role user (never ADMIN) in the same transaction.
    ...masterDataPaths('contacts', { singular: 'contact', description: 'contacts (Customer/Vendor/Both)' }),
    ...masterDataPaths('product-categories', { singular: 'product category', description: 'product categories' }),
    ...masterDataPaths('products', { singular: 'product', description: 'products (Goods/Service/Combo)' }),
    ...masterDataPaths('accounts', { singular: 'account', description: 'Chart of Accounts entries' }),
    ...masterDataPaths('journals', { singular: 'journal', description: 'journals (Sales/Purchase/Bank/Cash)' }),
    ...masterDataPaths('analytic-accounts', { singular: 'analytic account', description: 'analytic accounts (Income/Expense)' }),
    ...masterDataPaths('budgets', { singular: 'budget', description: 'budgets' }),
    '/journal-entries': { get: { summary: 'List Journal Entries (search, filter by journal/status/date, paginate)', security: [{ cookieAuth: [] }] }, post: { summary: 'Create a draft Journal Entry', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Draft created' }, 400: { description: 'Invalid accounting lines' }, 403: { description: 'ADMIN or ACCOUNTANT required' } } } },
    '/journal-entries/{id}': { get: { summary: 'Get a Journal Entry with its lines', security: [{ cookieAuth: [] }] }, patch: { summary: 'Update a draft Journal Entry (rejected once POSTED)', security: [{ cookieAuth: [] }] } },
    '/journal-entries/{id}/post': { post: { summary: 'Atomically post a draft Journal Entry — rejected unless total debit = total credit', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Posted' }, 400: { description: 'Not a draft, or debits and credits do not match' } } } },
    '/journal-entries/{id}/cancel': { post: { summary: 'Cancel a draft Journal Entry', security: [{ cookieAuth: [] }] } },
    '/accounts/{id}/balance': { get: { summary: 'Get one account\'s posted-only debit/credit totals and balance', security: [{ cookieAuth: [] }] } },
    '/accounts/{id}/ledger': { get: { summary: 'Get one account\'s posted-only ledger with a running balance (filter by date range, journal, reference)', security: [{ cookieAuth: [] }] } },
    '/accounts/balances': { get: { summary: 'List every account with its posted-only debit/credit totals and balance', security: [{ cookieAuth: [] }] } },
    '/accounting/summary': { get: { summary: 'Count and total Journal Entries grouped by status', security: [{ cookieAuth: [] }] } },

    // Sales — Sales Order creation/confirmation never posts accounting; only
    // Customer Invoice posting does (Debit Debtors, Credit Sales Income + Output Tax Payable).
    '/sales/orders': {
      get: { summary: 'List Sales Orders (search, filter by status/customer, paginate)', security: [{ cookieAuth: [] }] },
      post: { summary: 'Create a draft Sales Order — customer must be an active Customer/Both contact, products must be active', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Draft created' }, 400: { description: 'Invalid customer, product, quantity, price, or tax' } } },
    },
    '/sales/orders/{id}': { get: { summary: 'Get a Sales Order with its items', security: [{ cookieAuth: [] }] }, patch: { summary: 'Update a draft Sales Order (rejected once CONFIRMED/CANCELLED)', security: [{ cookieAuth: [] }] } },
    '/sales/orders/{id}/confirm': { post: { summary: 'Confirm a draft Sales Order — no accounting impact', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Confirmed' }, 400: { description: 'Not a draft order' } } } },
    '/sales/orders/{id}/cancel': { post: { summary: 'Cancel a draft Sales Order', security: [{ cookieAuth: [] }] } },
    '/sales/invoices': {
      get: { summary: 'List Customer Invoices (search, filter by status/paymentStatus/customer, paginate)', security: [{ cookieAuth: [] }] },
      post: { summary: 'Create a draft Customer Invoice, optionally linked to a confirmed Sales Order — no accounting impact', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Draft created' }, 400: { description: 'Invalid customer, product, dates, quantity, price, or tax' } } },
    },
    '/sales/invoices/from-order/{orderId}': { get: { summary: 'Prefill a Customer Invoice from a confirmed Sales Order (does not create it)', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Prefilled invoice payload' }, 400: { description: 'Order is not confirmed' } } } },
    '/sales/invoices/{id}': { get: { summary: 'Get a Customer Invoice with its items', security: [{ cookieAuth: [] }] }, patch: { summary: 'Update a draft Customer Invoice (rejected once POSTED/CANCELLED)', security: [{ cookieAuth: [] }] } },
    '/sales/invoices/{id}/pdf': {
      get: {
        summary: 'Download official Customer Invoice PDF (ADMIN, ACCOUNTANT, or authorized customer CONTACT)',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'PDF stream', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          401: { description: 'Authentication required' },
          403: { description: 'Access forbidden (IDOR protection)' },
          404: { description: 'Invoice not found' },
        },
      },
    },
    '/sales/invoices/{id}/post': { post: { summary: 'Post a draft Customer Invoice and atomically create its balanced Sales Journal entry', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Invoice posted with journal entry' }, 400: { description: 'Already posted or accounting configuration is invalid' } } } },
    '/sales/invoices/{id}/cancel': { post: { summary: 'Cancel a draft Customer Invoice', security: [{ cookieAuth: [] }] } },
    '/sales/invoices/{id}/outstanding': { get: { summary: 'Total/paid/outstanding amount for a Customer Invoice', security: [{ cookieAuth: [] }] } },
    '/sales/invoices/{id}/payments': { post: { summary: 'Record a Customer Payment — Debit Cash/Bank, Credit Debtors; rejects overpayment', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Payment recorded and posted' }, 400: { description: 'Invoice not posted, already fully paid, or amount invalid/exceeds outstanding' } } } },

    // Purchases — mirrors Sales: PO confirmation never posts accounting; only
    // Vendor Bill posting does (Debit Purchase Expense, Credit Creditors).
    '/purchases/orders': {
      get: { summary: 'List Purchase Orders (search, filter by status/vendor, paginate)', security: [{ cookieAuth: [] }] },
      post: { summary: 'Create a draft Purchase Order — vendor must be an active Vendor/Both contact, products must be active', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Draft created' }, 400: { description: 'Invalid vendor, product, quantity, price, or tax' } } },
    },
    '/purchases/orders/{id}': { get: { summary: 'Get a Purchase Order with its items', security: [{ cookieAuth: [] }] }, patch: { summary: 'Update a draft Purchase Order (rejected once CONFIRMED/CANCELLED)', security: [{ cookieAuth: [] }] } },
    '/purchases/orders/{id}/confirm': { post: { summary: 'Confirm a draft Purchase Order — no accounting impact', security: [{ cookieAuth: [] }] } },
    '/purchases/orders/{id}/cancel': { post: { summary: 'Cancel a draft Purchase Order', security: [{ cookieAuth: [] }] } },
    '/purchases/bills': {
      get: { summary: 'List Vendor Bills (search, filter by status/paymentStatus/vendor, paginate)', security: [{ cookieAuth: [] }] },
      post: { summary: 'Create a draft Vendor Bill, optionally linked to a confirmed Purchase Order for the same vendor — no accounting impact', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Draft created' }, 400: { description: 'Invalid vendor, product, dates, quantity, price, or tax' } } },
    },
    '/purchases/bills/from-order/{orderId}': { get: { summary: 'Prefill a Vendor Bill from a confirmed Purchase Order (does not create it)', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Prefilled bill payload' }, 400: { description: 'Order is not confirmed' } } } },
    '/purchases/bills/{id}': { get: { summary: 'Get a Vendor Bill with its items', security: [{ cookieAuth: [] }] }, patch: { summary: 'Update a draft Vendor Bill (rejected once POSTED)', security: [{ cookieAuth: [] }] } },
    '/purchases/bills/{id}/pdf': {
      get: {
        summary: 'Download official Vendor Bill PDF (ADMIN, ACCOUNTANT, or authorized vendor CONTACT)',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'PDF stream', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          401: { description: 'Authentication required' },
          403: { description: 'Access forbidden (IDOR protection)' },
          404: { description: 'Bill not found' },
        },
      },
    },
    '/purchases/bills/{id}/post': { post: { summary: 'Post a draft Vendor Bill and atomically create its balanced Purchase Journal entry', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Bill posted with journal entry' }, 400: { description: 'Already posted or accounting configuration is invalid' } } } },
    '/purchases/bills/{id}/cancel': { post: { summary: 'Cancel a draft Vendor Bill', security: [{ cookieAuth: [] }] } },
    '/purchases/bills/{id}/outstanding': { get: { summary: 'Total/paid/outstanding amount for a Vendor Bill', security: [{ cookieAuth: [] }] } },
    '/purchases/bills/{id}/payments': { post: { summary: 'Record a Vendor Payment — Debit Creditors, Credit Cash/Bank; rejects overpayment', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Payment recorded and posted' }, 400: { description: 'Bill not posted, already fully paid, or amount invalid/exceeds outstanding' } } } },

    // Payments — cancelling never mutates the original posted entry; it
    // posts a reversing entry (debit/credit swapped) and recomputes payment status.
    '/payments': { get: { summary: 'List all payments (search, filter by type/status/contact/invoice/bill, paginate)', security: [{ cookieAuth: [] }] } },
    '/payments/{id}': { get: { summary: 'Get a payment by id', security: [{ cookieAuth: [] }] } },
    '/payments/{id}/receipt/pdf': {
      get: {
        summary: 'Download official Payment Receipt / Voucher PDF (ADMIN, ACCOUNTANT, or authorized CONTACT)',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'PDF stream', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          401: { description: 'Authentication required' },
          403: { description: 'Access forbidden (IDOR protection)' },
          404: { description: 'Payment not found' },
        },
      },
    },
    '/payments/{id}/cancel': { post: { summary: 'Cancel a posted payment via a reversing Journal Entry; recomputes the invoice/bill payment status', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Cancelled with reversal entry' }, 400: { description: 'Payment already cancelled' } } } },
    '/portal/summary': {
      get: {
        summary: 'Get Customer or Vendor portal dashboard summary (KPIs, recent documents, recent payments)',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Portal summary data' },
          401: { description: 'Authentication required' },
          403: { description: 'CONTACT role required' },
        },
      },
    },
    '/inventory': { get: { summary: 'List GOODS inventory with current stock, valuation, status, search and pagination (ADMIN/ACCOUNTANT)', security: [{ cookieAuth: [] }], parameters: [{ name: 'page', in: 'query' }, { name: 'limit', in: 'query' }, { name: 'search', in: 'query' }, { name: 'status', in: 'query', schema: { enum: ['IN_STOCK','LOW_STOCK','OUT_OF_STOCK'] } }], responses: { 200: { description: 'Inventory and summary' }, 401: { description: 'Authentication required' }, 403: { description: 'Internal roles only' } } } },
    '/inventory/movements': { get: { summary: 'List immutable stock ledger movements with database filtering and pagination', security: [{ cookieAuth: [] }], parameters: [{ name: 'productId', in: 'query' }, { name: 'movementType', in: 'query' }, { name: 'dateFrom', in: 'query' }, { name: 'dateTo', in: 'query' }, { name: 'search', in: 'query' }] } },
    '/inventory/{productId}': { get: { summary: 'Get a product stock balance and valuation', security: [{ cookieAuth: [] }] } },
    '/inventory/{productId}/movements': { get: { summary: 'Get one product movement history', security: [{ cookieAuth: [] }] } },
    '/inventory/adjustments': { post: { summary: 'Create an audited ADMIN-only physical stock adjustment. Reason is required; negative stock is rejected.', security: [{ cookieAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['productId','direction','quantity','reason'], properties: { productId: { type: 'string' }, direction: { enum: ['IN','OUT'] }, quantity: { type: 'number' }, reason: { type: 'string' }, notes: { type: 'string' } } } } } }, responses: { 201: { description: 'Adjustment created' }, 400: { description: 'Invalid adjustment or insufficient stock' }, 403: { description: 'ADMIN required' } } } },
    '/reports/dashboard': { get: { summary: 'Financial reporting dashboard from posted journal entries only', security: [{ cookieAuth: [] }], parameters: [{ name: 'startDate', in: 'query' }, { name: 'endDate', in: 'query' }], responses: { 200: { description: 'Financial KPIs' }, 403: { description: 'ADMIN or ACCOUNTANT required' } } } },
    '/reports/trial-balance': { get: { summary: 'Trial balance by account, including debit/credit totals and balanced state; posted entries only', security: [{ cookieAuth: [] }], parameters: [{ name: 'startDate', in: 'query' }, { name: 'endDate', in: 'query' }] } },
    '/reports/general-ledger': { get: { summary: 'Paginated posted General Ledger for one account, with opening/running/closing balances', security: [{ cookieAuth: [] }], parameters: [{ name: 'accountId', in: 'query', required: true }, { name: 'startDate', in: 'query' }, { name: 'endDate', in: 'query' }, { name: 'journalId', in: 'query' }, { name: 'search', in: 'query' }, { name: 'page', in: 'query' }, { name: 'limit', in: 'query' }], responses: { 400: { description: 'Missing/invalid filter' }, 404: { description: 'Account not found' } } } },
    '/reports/profit-loss': { get: { summary: 'Profit and Loss from INCOME and EXPENSE posted journal lines', security: [{ cookieAuth: [] }], parameters: [{ name: 'startDate', in: 'query' }, { name: 'endDate', in: 'query' }] } },
    '/reports/balance-sheet': { get: { summary: 'Balance Sheet from ASSET, LIABILITY and CAPITAL accounts, plus calculated current-period profit', security: [{ cookieAuth: [] }], parameters: [{ name: 'endDate', in: 'query' }] } },
    '/reports/budget': { get: { summary: 'Budget versus actual based on analytic-account posted journal lines', security: [{ cookieAuth: [] }], parameters: [{ name: 'startDate', in: 'query' }, { name: 'endDate', in: 'query' }] } },
    '/analytics/dashboard': { get: { summary: 'Executive analytics KPIs, inventory alerts, rankings and recent activity from live database data (ADMIN/ACCOUNTANT)', security: [{ cookieAuth: [] }], parameters: [{ name: 'startDate', in: 'query' }, { name: 'endDate', in: 'query' }], responses: { 200: { description: 'Analytics dashboard' }, 403: { description: 'Internal roles only' } } } },
    '/analytics/sales': { get: { summary: 'Posted-invoice sales totals, top products and customers (ADMIN/ACCOUNTANT)', security: [{ cookieAuth: [] }] } },
    '/analytics/purchases': { get: { summary: 'Posted vendor-bill purchase totals and top vendors (ADMIN/ACCOUNTANT)', security: [{ cookieAuth: [] }] } },
    '/analytics/inventory': { get: { summary: 'Current stock valuation, product counts and low-stock alerts (ADMIN/ACCOUNTANT)', security: [{ cookieAuth: [] }] } },
    '/analytics/receivables': { get: { summary: 'Customer receivable ageing, payment status counts and outstanding customers (ADMIN/ACCOUNTANT)', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Receivables ageing' }, 403: { description: 'Internal roles only' } } } },
    '/analytics/payables': { get: { summary: 'Vendor payable ageing, payment status counts and outstanding vendors (ADMIN/ACCOUNTANT)', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Payables ageing' }, 403: { description: 'Internal roles only' } } } },
    '/analytics/cash-flow': { get: { summary: 'Recorded customer receipts and vendor-payment cash flow (ADMIN/ACCOUNTANT)', security: [{ cookieAuth: [] }], parameters: [{ name: 'startDate', in: 'query' }, { name: 'endDate', in: 'query' }] } },
    '/analytics/trends': { get: { summary: 'Monthly revenue and expense trend from posted journal entries (ADMIN/ACCOUNTANT)', security: [{ cookieAuth: [] }], parameters: [{ name: 'startDate', in: 'query' }, { name: 'endDate', in: 'query' }] } },
    '/admin/users': { get: { summary: 'Admin user list with database search/filter/pagination', security: [{ cookieAuth: [] }] }, post: { summary: 'Create an approved Admin, Accountant, or contact-linked CONTACT user', security: [{ cookieAuth: [] }] } },
    '/admin/users/{id}': { patch: { summary: 'Admin update/deactivate/reset a user; final active administrator is protected', security: [{ cookieAuth: [] }] } },
    '/admin/taxes': { get: { summary: 'List tax configurations (ADMIN)', security: [{ cookieAuth: [] }] }, post: { summary: 'Create a validated tax configuration with optional active tax account (ADMIN)', security: [{ cookieAuth: [] }] } },
    '/admin/taxes/{id}/archive': { post: { summary: 'Archive a tax configuration without changing historical records (ADMIN)', security: [{ cookieAuth: [] }] } },
    '/admin/audit-logs': { get: { summary: 'Paginated, filtered audit log viewer (ADMIN only)', security: [{ cookieAuth: [] }] } },
    '/admin/fiscal-periods': { get: { summary: 'List fiscal periods', security: [{ cookieAuth: [] }] }, post: { summary: 'Create an open fiscal period', security: [{ cookieAuth: [] }] } },
    '/admin/fiscal-periods/{id}/close': { post: { summary: 'Close a fiscal period; postings are then rejected', security: [{ cookieAuth: [] }] } },
    '/admin/fiscal-periods/{id}/reopen': { post: { summary: 'Reopen a fiscal period (audited)', security: [{ cookieAuth: [] }] } },
    '/admin/settings': { get: { summary: 'Read system settings (ADMIN)', security: [{ cookieAuth: [] }] } },
    '/admin/settings/{key}': { put: { summary: 'Update a validated operational setting (ADMIN)', security: [{ cookieAuth: [] }] } },
    '/admin/system-health': { get: { summary: 'Safe administrative diagnostics without secret exposure', security: [{ cookieAuth: [] }] } },
    '/search': { get: { summary: 'Internal database-backed global search', security: [{ cookieAuth: [] }] } },
    '/notifications': { get: { summary: 'Internal low-stock and overdue-invoice alerts from live data', security: [{ cookieAuth: [] }] } },

    // AI Assistant (Phase 11) — read-only accounting/business Q&A over a
    // fixed set of controlled tools that call existing, already-authorized
    // reporting/analytics services. ADMIN and ACCOUNTANT only; CONTACT is
    // rejected by the same authenticate()/authorize() middleware used
    // everywhere else, never by the AI model itself. No write actions.
    '/ai/chat': {
      post: {
        summary: 'Ask the AI assistant a business/accounting question or continue a conversation (ADMIN/ACCOUNTANT)',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string', maxLength: 1000, description: 'The user question. Max 1000 characters.' },
                  conversationId: { type: 'string', format: 'uuid', description: 'Omit to start a new conversation.' },
                  context: {
                    type: 'object',
                    description: 'Optional page context. The current record id is always re-authorized server-side before use.',
                    properties: {
                      currentPage: { type: 'string' },
                      selectedRecordId: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'AI answer, grounded only in data returned by controlled application tools',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    answer: { type: 'string' },
                    conversationId: { type: 'string', format: 'uuid' },
                    sources: { type: 'array', items: { type: 'string' }, description: 'Human-readable names of the reports/analytics the answer was based on' },
                    toolCalls: { type: 'array', items: { type: 'string' }, description: 'Names of controlled tools invoked to answer this question' },
                    status: { type: 'string', enum: ['ok', 'not_configured', 'provider_error'] },
                  },
                },
              },
            },
          },
          400: { description: 'Empty message, or message exceeds the maximum length.' },
          401: { description: 'Authentication required.' },
          403: { description: 'ADMIN or ACCOUNTANT role required — CONTACT and unauthenticated callers never reach the AI model.' },
        },
      },
    },
    '/ai/conversations': {
      get: { summary: 'List the authenticated user\'s own AI conversations (ADMIN/ACCOUNTANT)', security: [{ cookieAuth: [] }], responses: { 200: { description: 'OK' }, 401: { description: 'Authentication required.' }, 403: { description: 'ADMIN or ACCOUNTANT role required.' } } },
    },
    '/ai/conversations/{id}': {
      get: { summary: 'Get one of the authenticated user\'s own conversations with its messages', security: [{ cookieAuth: [] }], responses: { 200: { description: 'OK' }, 404: { description: 'Not found, or owned by a different user.' } } },
      delete: { summary: 'Delete one of the authenticated user\'s own conversations', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found, or owned by a different user.' } } },
    },
    '/ai/suggestions': {
      get: { summary: 'Static, role-based example questions for the chat UI — costs no AI call', security: [{ cookieAuth: [] }], responses: { 200: { description: 'OK' }, 403: { description: 'ADMIN or ACCOUNTANT role required.' } } },
    },
  },
};

module.exports = { openApiDocument };
