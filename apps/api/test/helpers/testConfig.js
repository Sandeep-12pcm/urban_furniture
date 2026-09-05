const path = require('path');
const dotenv = require('dotenv');

// A dedicated override is preferred for CI. Locally, reuse only the
// connection credentials from the API environment and always target the
// disposable test database below. This avoids a second, stale password being
// hard-coded in the Jest setup.
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TEST_DB_NAME = process.env.TEST_DATABASE_NAME || 'urban_furniture_test';
const configuredUrl = process.env.TEST_DATABASE_ADMIN_URL || process.env.DATABASE_URL;

if (!configuredUrl) {
  throw new Error('DATABASE_URL or TEST_DATABASE_ADMIN_URL is required to run database tests.');
}

const adminUrl = new URL(configuredUrl);
adminUrl.pathname = '/postgres';
adminUrl.search = '';
adminUrl.hash = '';

const testUrl = new URL(adminUrl);
testUrl.pathname = `/${TEST_DB_NAME}`;

module.exports = {
  TEST_DB_NAME,
  ADMIN_URL: adminUrl.toString(),
  TEST_DATABASE_URL: testUrl.toString(),
};
