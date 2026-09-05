const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');
const { TEST_DATABASE_URL } = require('./testConfig');

const MASTER_DATA_TABLES = [
  'budgets',
  'analytic_accounts',
  'journals',
  'accounts',
  'products',
  'product_categories',
  'contacts',
];

function createTestPool() {
  return new Pool({ connectionString: TEST_DATABASE_URL });
}

async function resetDatabase(pool) {
  await pool.query('TRUNCATE audit_logs, password_reset_tokens, users RESTART IDENTITY CASCADE');
  await pool.query(`TRUNCATE ${MASTER_DATA_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

async function createUser(pool, role, overrides = {}) {
  const id = overrides.id || randomUUID();
  const loginId = overrides.loginId || `${role.toLowerCase()}-${id.slice(0, 8)}`;
  const password = overrides.password || 'Secure@123';
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (id, login_id, email, password_hash, role, is_active, contact_id, account_type, approval_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      loginId,
      overrides.email || `${loginId}@urbanfurniture.local`,
      passwordHash,
      role,
      overrides.isActive ?? true,
      overrides.contactId || null,
      overrides.accountType || null,
      overrides.approvalStatus || 'APPROVED',
    ],
  );

  return { id, loginId, password };
}

module.exports = { createTestPool, resetDatabase, createUser, TEST_DATABASE_URL };
