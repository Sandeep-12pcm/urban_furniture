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

  app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ message: 'Internal server error.' });
  });

  return app;
}

module.exports = { createApp };
