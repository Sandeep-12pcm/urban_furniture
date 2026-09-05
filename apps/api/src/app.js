const cors = require('cors');
const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const { config } = require('./config');
const { openApiDocument } = require('./openapi');

// Import official Member 1 routes from server
const serverSrc = path.resolve(__dirname, '../../../server/src');
const authRoutes = require(path.join(serverSrc, 'routes/auth.routes'));
const contactRoutes = require(path.join(serverSrc, 'routes/contact.routes'));
const productRoutes = require(path.join(serverSrc, 'routes/product.routes'));
const accountRoutes = require(path.join(serverSrc, 'routes/account.routes'));
const journalRoutes = require(path.join(serverSrc, 'routes/journal.routes'));
const analyticRoutes = require(path.join(serverSrc, 'routes/analytic.routes'));
const budgetRoutes = require(path.join(serverSrc, 'routes/budget.routes'));
const { errorResponse } = require(path.join(serverSrc, 'utils/response'));

function createApp() {
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
      return callback(null, true);
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      ok: true,
      service: 'urban-furniture-api',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));

  // Mount official Member 1 backend master-data routes
  app.use('/api/auth', authRoutes);
  app.use('/api/contacts', contactRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/journals', journalRoutes);
  app.use('/api/analytic-accounts', analyticRoutes);
  app.use('/api/budgets', budgetRoutes);

  app.use((req, res) => {
    return errorResponse(res, `Route not found: ${req.method} ${req.path}`, ['Endpoint does not exist.'], 404);
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    const status = error.statusCode || 500;
    return errorResponse(res, error.message || 'Internal server error.', [error.message], status);
  });

  return app;
}

module.exports = { createApp };
