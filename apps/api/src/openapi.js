const openApiDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Urban Furniture Accounting Auth API',
    version: '0.1.0',
    description: 'Express REST API for JWT authentication and RBAC.',
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
    '/users/{id}/approve-accountant': {
      post: { summary: 'Admin-only approval for pending Accountant accounts', security: [{ cookieAuth: [] }] },
    },
    '/admin/health': { get: { summary: 'Admin-only protected route', security: [{ cookieAuth: [] }] } },
    '/contact/portal': { get: { summary: 'Contact-only protected route', security: [{ cookieAuth: [] }] } },
  },
};

module.exports = { openApiDocument };
