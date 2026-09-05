const express = require('express');
const cors = require('cors');
const { config } = require('./config');

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
      return callback(null, true); // Allow during development
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Mount routes
  const authRoutes = require('./routes/auth.routes');
  const contactRoutes = require('./routes/contact.routes');
  const productRoutes = require('./routes/product.routes');
  const accountRoutes = require('./routes/account.routes');
  const journalRoutes = require('./routes/journal.routes');
  const analyticRoutes = require('./routes/analytic.routes');
  const budgetRoutes = require('./routes/budget.routes');
  const { transactionRouter } = require('./routes/transaction.routes');
  app.use('/api/auth', authRoutes);
  app.use('/api/contacts', contactRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/journals', journalRoutes);
  app.use('/api/analytic-accounts', analyticRoutes);
  app.use('/api/budgets', budgetRoutes);
  app.use('/api', transactionRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      service: 'urban-furniture-accounting-server',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // 404 handler
  const { errorResponse } = require('./utils/response');
  app.use((req, res) => {
    return errorResponse(res, `Route not found: ${req.method} ${req.path}`, ['Endpoint does not exist.'], 404);
  });

  // Global error handler
  app.use((err, _req, res, _next) => {
    const status = err.statusCode || 500;
    return errorResponse(res, err.message || 'Internal server error.', [err.message], status);
  });

  return app;
}

module.exports = { createApp };
