// Standard Master Data CRUD + archive/restore path documentation, shared by
// every Phase 1 resource. ADMIN and ACCOUNTANT can create/view/update;
// ADMIN alone may archive/restore. CONTACT and unauthenticated callers are
// rejected by the authenticate()/authorize() middleware (401/403).
function masterDataPaths(resource, { singular, plural = resource, description }) {
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
    version: '0.2.0',
    description: 'Express REST API for JWT authentication, RBAC, and Phase 1 Master Data.',
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
  },
};

module.exports = { openApiDocument };
