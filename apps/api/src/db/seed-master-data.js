const { randomUUID } = require('crypto');
const { pool } = require('./pool');
const { config } = require('../config');

// Clearly-marked development/sample Master Data. Every insert is keyed by a
// natural unique value (account code, journal name, category name) and uses
// ON CONFLICT DO NOTHING, so this script is safe to run repeatedly.

const CATEGORIES = ['Chairs', 'Tables', 'Sofas', 'Office Furniture'];

const ACCOUNTS = [
  { code: '1001', name: 'Cash', type: 'ASSET' },
  { code: '1002', name: 'Bank', type: 'ASSET' },
  { code: '1003', name: 'Debtors', type: 'ASSET' },
  { code: '2001', name: 'Creditors', type: 'LIABILITY' },
  { code: '2002', name: 'Output Tax Payable', type: 'LIABILITY' },
  { code: '3001', name: 'Owner Capital', type: 'CAPITAL' },
  { code: '4001', name: 'Sales Income', type: 'INCOME' },
  { code: '5001', name: 'Purchase Expense', type: 'EXPENSE' },
];

const JOURNALS = [
  { name: 'Sales Journal', type: 'SALES', accountCode: '4001' },
  { name: 'Purchase Journal', type: 'PURCHASE', accountCode: '5001' },
  { name: 'Bank Journal', type: 'BANK', accountCode: '1002' },
  { name: 'Cash Journal', type: 'CASH', accountCode: '1001' },
];

async function seedCategories() {
  for (const name of CATEGORIES) {
    await pool.query(
      `INSERT INTO product_categories (id, name)
       VALUES ($1, $2)
       ON CONFLICT (lower(name)) DO NOTHING`,
      [randomUUID(), name],
    );
  }
  console.log(`Product categories seeded: ${CATEGORIES.join(', ')}`);
}

async function seedAccounts() {
  for (const account of ACCOUNTS) {
    await pool.query(
      `INSERT INTO accounts (id, account_code, account_name, type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (account_code) DO NOTHING`,
      [randomUUID(), account.code, account.name, account.type],
    );
  }
  console.log(`Chart of Accounts seeded: ${ACCOUNTS.map((a) => `${a.code} ${a.name}`).join(', ')}`);
}

async function seedJournals() {
  for (const journal of JOURNALS) {
    const account = await pool.query('SELECT id FROM accounts WHERE account_code = $1', [journal.accountCode]);
    if (!account.rowCount) {
      console.warn(`Skipping journal "${journal.name}": account ${journal.accountCode} was not found.`);
      continue;
    }
    await pool.query(
      `INSERT INTO journals (id, name, type, default_account_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (lower(name)) DO NOTHING`,
      [randomUUID(), journal.name, journal.type, account.rows[0].id],
    );
  }
  console.log(`Journals seeded: ${JOURNALS.map((j) => j.name).join(', ')}`);
}

async function seedMasterData() {
  await seedCategories();
  await seedAccounts();
  await seedJournals();
  console.log('Master Data seed complete (development/sample data).');
}

seedMasterData()
  .catch((error) => {
    console.error('Master Data seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

module.exports = { seedMasterData, config };
