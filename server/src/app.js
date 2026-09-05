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
