const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function migrate() {
  const schemaPath = path.resolve(__dirname, '../sql/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Database migrated successfully.');
}

migrate()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
