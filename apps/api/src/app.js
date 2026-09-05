const cors = require('cors');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { config } = require('./config');
const { pool } = require('./db/pool');
const { authRoutes } = require('./routes/auth');
const { usersRoutes } = require('./routes/users');
const { contactsRoutes } = require('./routes/contacts');
const { productCategoriesRoutes } = require('./routes/productCategories');
const { productsRoutes } = require('./routes/products');
const { accountsRoutes } = require('./routes/accounts');
const { journalsRoutes } = require('./routes/journals');
const { analyticAccountsRoutes } = require('./routes/analyticAccounts');
const { budgetsRoutes } = require('./routes/budgets');
const { journalEntriesRoutes, accountingReportsRoutes } = require('./routes/journalEntries');
const { purchasesRoutes } = require('./routes/purchases');
const { salesRoutes } = require('./routes/sales');
const { paymentsRoutes } = require('./routes/payments');
const { inventoryRoutes } = require('./routes/inventory');
const { reportsRoutes } = require('./routes/reports');
const { analyticsRoutes } = require('./routes/analytics');
const { administrationRoutes, operationalRoutes } = require('./routes/administration');
const { openApiDocument } = require('./openapi');

function createApp(db = pool) {
  const app = express();
  const allowedOrigins = new Set([
    config.frontendUrl,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ]);

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  }));
  // Dependency-free baseline browser hardening for the JSON API. UI assets
  // are served separately by Vite/a reverse proxy, so a restrictive API CSP
  // does not interfere with the frontend.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (config.nodeEnv === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'urban-furniture-api' });
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/api/auth', authRoutes(db));
  app.use('/api', usersRoutes(db));
  app.use('/api', contactsRoutes(db));
  app.use('/api', productCategoriesRoutes(db));
  app.use('/api', productsRoutes(db));
  // accountingReportsRoutes defines literal routes like GET /accounts/balances
  // that must be registered before accountsRoutes' GET /accounts/:id, or
  // Express matches "balances" as the :id wildcard first and this 404s/500s.
  app.use('/api', accountingReportsRoutes(db));
  app.use('/api', accountsRoutes(db));
  app.use('/api', journalsRoutes(db));
  app.use('/api', analyticAccountsRoutes(db));
  app.use('/api', budgetsRoutes(db));
  app.use('/api', journalEntriesRoutes(db));
  app.use('/api', purchasesRoutes(db));
  app.use('/api', salesRoutes(db));
  app.use('/api', paymentsRoutes(db));
  app.use('/api', inventoryRoutes(db));
  app.use('/api', reportsRoutes(db));
  app.use('/api', analyticsRoutes(db));
  app.use('/api', administrationRoutes(db));
  app.use('/api', operationalRoutes(db));

  app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
  });

  app.use((error, _req, res, _next) => {
    // Keep diagnostics server-side without serializing raw database/config
    // errors to API callers.
    console.error({ message: error?.message, name: error?.name });
    res.status(500).json({ message: 'Internal server error.' });
  });

  return app;
}

module.exports = { createApp };
