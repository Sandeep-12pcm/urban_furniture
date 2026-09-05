require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'urban-furniture-super-secret-jwt-key-hackathon-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  adminLoginId: process.env.ADMIN_LOGIN_ID || 'admin',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@urbanfurniture.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMe@12345',
};

module.exports = { config };
