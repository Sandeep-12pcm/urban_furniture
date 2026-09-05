const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { pool } = require('./pool');
const { config } = require('../config');

async function seedAdmin() {
  const { loginId, email, password } = config.admin;
  const existing = await pool.query(
    'SELECT id, login_id, role FROM users WHERE login_id = $1 OR email = $2 LIMIT 1',
    [loginId, email.toLowerCase()],
  );

  if (existing.rowCount > 0) {
    if (existing.rows[0].role !== 'ADMIN') {
      throw new Error('ADMIN_LOGIN_ID or ADMIN_EMAIL is already used by a non-admin account.');
    }
    console.log(`Admin seed skipped: ${existing.rows[0].login_id} already exists.`);
    return;
  }

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (id, login_id, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'ADMIN')`,
    [id, loginId, email.toLowerCase(), passwordHash],
  );
  await pool.query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, metadata)
     VALUES ($1, $2, 'USER_CREATED', 'User', $2, $3)`,
    [randomUUID(), id, JSON.stringify({ source: 'seed', role: 'ADMIN' })],
  );

  console.log(`Admin seeded: ${loginId}`);
}

seedAdmin()
  .catch((error) => {
    console.error('Admin seed failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
