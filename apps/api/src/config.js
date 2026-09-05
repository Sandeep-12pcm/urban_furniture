const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function normalizeDatabaseUrl(value) {
  if (!value) throw new Error('DATABASE_URL is required.');
  const url = new URL(value);
  url.searchParams.delete('schema');
  return url.toString();
}

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}

const config = {
  databaseUrl: normalizeDatabaseUrl(process.env.DATABASE_URL),
  jwtSecret: process.env.JWT_SECRET || 'development-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  enablePublicSignup: process.env.ENABLE_PUBLIC_SIGNUP === 'true',
  admin: {
    loginId: process.env.ADMIN_LOGIN_ID || 'admin',
    email: process.env.ADMIN_EMAIL || 'admin@urbanfurniture.local',
    password: process.env.ADMIN_PASSWORD || (isProduction ? undefined : 'ChangeMe@12345'),
  },
};

module.exports = { config };
