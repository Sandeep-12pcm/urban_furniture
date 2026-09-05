const fs = require('fs');
const path = require('path');
const { Client, Pool } = require('pg');

const TEST_DB_NAME = process.env.TEST_DATABASE_NAME || 'urban_furniture_test';
const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

module.exports = async function globalSetup() {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE)`);
  } catch {
    // Older PostgreSQL without WITH (FORCE) support; fall back to a plain drop.
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`).catch(() => {});
  }
  await admin.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  await admin.end();

  const schemaSql = fs.readFileSync(path.resolve(__dirname, '../src/sql/schema.sql'), 'utf8');
  const testPool = new Pool({ connectionString: `${ADMIN_URL.replace(/\/[^/]*$/, '')}/${TEST_DB_NAME}` });
  await testPool.query(schemaSql);
  await testPool.end();
};
