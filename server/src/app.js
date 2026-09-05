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
  app.use('/api/auth', authRoutes);
  app.use('/api/contacts', contactRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/journals', journalRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      service: 'urban-furniture-accounting-server',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

module.exports = { createApp };
