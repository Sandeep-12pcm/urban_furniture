const { randomUUID } = require('crypto');

// Seeds the minimum Chart of Accounts + Journals that Sales/Purchase/Payment
// posting depends on (mirrors apps/api/src/db/seed-master-data.js), plus a
// category/product/contacts pair, so accounting/purchase/sales tests don't
// each re-derive this boilerplate.
async function seedAccountingFixtures(pool) {
  const accounts = [
    { code: '1001', name: 'Cash', type: 'ASSET' },
    { code: '1002', name: 'Bank', type: 'ASSET' },
    { code: '1003', name: 'Debtors', type: 'ASSET' },
    { code: '2001', name: 'Creditors', type: 'LIABILITY' },
    { code: '2002', name: 'Output Tax Payable', type: 'LIABILITY' },
    { code: '3001', name: 'Owner Capital', type: 'CAPITAL' },
    { code: '4001', name: 'Sales Income', type: 'INCOME' },
    { code: '5001', name: 'Purchase Expense', type: 'EXPENSE' },
  ];
  const accountIds = {};
  for (const account of accounts) {
    const id = randomUUID();
    await pool.query('INSERT INTO accounts (id, account_code, account_name, type) VALUES ($1, $2, $3, $4)', [id, account.code, account.name, account.type]);
    accountIds[account.code] = id;
  }

  const journals = [
    { name: 'Sales Journal', type: 'SALES', accountCode: '4001' },
    { name: 'Purchase Journal', type: 'PURCHASE', accountCode: '5001' },
    { name: 'Bank Journal', type: 'BANK', accountCode: '1002' },
    { name: 'Cash Journal', type: 'CASH', accountCode: '1001' },
  ];
  const journalIds = {};
  for (const journal of journals) {
    const id = randomUUID();
    await pool.query('INSERT INTO journals (id, name, type, default_account_id) VALUES ($1, $2, $3, $4)', [id, journal.name, journal.type, accountIds[journal.accountCode]]);
    journalIds[journal.type] = id;
  }

  const categoryId = randomUUID();
  await pool.query('INSERT INTO product_categories (id, name) VALUES ($1, $2)', [categoryId, 'Chairs']);

  return { accountIds, journalIds, categoryId };
}

async function createContact(pool, type, overrides = {}) {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO contacts (id, name, type, email) VALUES ($1, $2, $3, $4)',
    [id, overrides.name || `${type} Contact`, type, overrides.email || null],
  );
  return id;
}

async function createProduct(pool, categoryId, overrides = {}) {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO products (id, name, type, sales_price, purchase_price, category_id) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, overrides.name || 'Office Chair', overrides.type || 'GOODS', overrides.salesPrice ?? 5000, overrides.purchasePrice ?? 3500, categoryId],
  );
  return id;
}

module.exports = { seedAccountingFixtures, createContact, createProduct };
