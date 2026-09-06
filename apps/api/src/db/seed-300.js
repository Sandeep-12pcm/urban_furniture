const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('./pool');

const TAX_RATES = [0, 5, 12, 18, 28];

const CITIES = [
  { city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
  { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
  { city: 'Delhi', state: 'Delhi', pincode: '110001' },
  { city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
  { city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
  { city: 'Pune', state: 'Maharashtra', pincode: '411001' },
  { city: 'Ahmedabad', state: 'Gujarat', pincode: '380001' },
  { city: 'Kolkata', state: 'West Bengal', pincode: '700001' },
  { city: 'Jaipur', state: 'Rajasthan', pincode: '302001' },
  { city: 'Gurugram', state: 'Haryana', pincode: '122001' },
  { city: 'Noida', state: 'Uttar Pradesh', pincode: '201301' },
  { city: 'Kochi', state: 'Kerala', pincode: '682001' },
  { city: 'Chandigarh', state: 'Punjab', pincode: '160001' },
  { city: 'Indore', state: 'Madhya Pradesh', pincode: '452001' },
  { city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641001' }
];

const CATEGORY_NAMES = [
  'Ergonomic Office Chairs', 'Executive High-Back Chairs', 'Mesh Task Chairs', 'Lounge Armchairs', 'Conference Room Chairs',
  'Dining Chairs', 'Bar & Counter Stools', 'Drafting & Lab Stools', 'Acoustic Pods & Booths', 'Reception Soft Seating',
  'Sectional Sofas', 'Chesterfield Sofas', 'Modular Sofas', 'Reclining Sofas', 'Sofa Beds & Futons',
  'Standing Motorized Desks', 'Executive L-Shaped Desks', 'Compact Work Desks', 'Conference Tables', 'Meeting Room Pods',
  'Solid Wood Dining Tables', 'Glass Top Coffee Tables', 'Side & Accent Tables', 'Console Tables', 'Bar Tables & High Tops',
  'Lateral Filing Cabinets', 'Pedestal Mobile Drawers', 'Metal Storage Lockers', 'Open Wooden Bookshelves', 'Heavy Duty Shelving',
  'Office Credenzas & Buffets', 'Sliding Door Storage Units', 'Tambour Door Cupboards', 'Display Curio Cabinets', 'Modular Wardrobes',
  'Acoustic Wall Panels', 'Hanging Ceiling Baffles', 'Freestanding Privacy Screens', 'Desk-Mounted Dividers', 'Soundproof Dividers',
  'Adjustable Monitor Arms', 'Under-Desk Cable Trays', 'Anti-Fatigue Foot Mats', 'Ergonomic Keyboard Trays', 'Power & Data Hubs',
  'Modern LED Desk Lamps', 'Pendant Office Lights', 'Architectural Floor Lamps', 'Recessed Track Lighting', 'Under-Cabinet LED Strips',
  'Magnetic Glass Whiteboards', 'Mobile Presentation Easels', 'Auditorium Tiered Seating', 'Cafeteria Dining Sets', 'Breakout Benches',
  'Outdoor Weatherproof Sofas', 'Patio Teak Dining Sets', 'Aluminum Garden Benches', 'Sunshade Canopy Loungers', 'Outdoor Bar Stools',
  'Heavy Duty Warehouse Racks', 'Industrial Utility Carts', 'Rolling Tool Chests', 'Assembly Workbenches', 'Steel Part Storage Bins',
  'Ergonomic Back Cushions', 'Leather Desk Blotters', 'Monitor Riser Shelves', 'Cable Management Spines', 'Footrest Rockers',
  'Training Room Flip Tables', 'Stackable Nesting Chairs', 'Collaborative Round Tables', 'Media Presentation Credenzas', 'Meeting Kiosks'
];

const PRODUCT_PREFIXES = [
  'Aeron Pro', 'ErgoMax Ultra', 'Steelcase Vantage', 'Nordic Timber', 'Verona Velvet', 'Axis Height-Adjustable',
  'Zenith Executive', 'Aura Minimalist', 'Matrix Modular', 'Olympus Heavy-Duty', 'Solace Orthopedic', 'Vanguard Premium',
  'Nexus Conference', 'Sierra Teak', 'Titan Reinforced', 'Luna Soft-Touch', 'Kvadrat Acoustic', 'Kallax Grid',
  'Milano Top-Grain', 'AeroFlow Breathable', 'Artisan Handcrafted', 'Horizon Panoramic', 'Pulse Dynamic', 'Optima Compact'
];

const PRODUCT_TYPES = ['GOODS', 'GOODS', 'GOODS', 'SERVICE', 'COMBO'];

const COMPANY_NAMES = [
  'Apex Workspace Solutions', 'Infiniti Systems Pvt Ltd', 'TechVista Hub', 'Heritage Woods & Timber', 'Urban Comfort Furnishings',
  'Zenith Commercial Interiors', 'BlueSky Architectural Labs', 'Kalyan Foam & Textiles', 'Steelcraft Modular India', 'MetroLiving Decor',
  'GreenLine Eco Furniture', 'PrimeEdge Corporate Infra', 'Royal Oak Supplies', 'Lotus Workspace Interiors', 'Benchmark Office Goods',
  'Titan Hardware & Fasteners', 'Prism Design Consultants', 'Orion Industrial Storage', 'Vanguard Leather Works', 'Cascade Office Solutions',
  'Summit Commercial Spaces', 'Elegance Home & Living', 'Precision Woodcraft', 'Starlight Hospitality Furnishings', 'Pioneer Ergonomics'
];

const INDIVIDUAL_NAMES = [
  'Aarav Sharma', 'Aditi Verma', 'Rohan Deshmukh', 'Priya Venkatesh', 'Kavita Sundaram', 'Vikram Malhotra',
  'Ananya Iyer', 'Rahul Banerjee', 'Sneha Kulkarni', 'Arjun Nambiar', 'Deepika Nair', 'Siddharth Mehta',
  'Pooja Choudhury', 'Gaurav Joshi', 'Neha Singhania', 'Aditya Rastogi', 'Tanvi Kapoor', 'Manish Bhardwaj',
  'Shweta Mukherjee', 'Karan Johar', 'Bhavna Parekh', 'Rajeshwari Patel', 'Sunil Mittal', 'Divya Saxena'
];

async function seed300() {
  console.log('--- Starting 300 Seed Data Generation (with Portals & Demo Users) ---');

  // Compute password hash for standard demo users
  const demoPasswordHash = await bcrypt.hash('Demo1234!', 10);

  // 1. Admin user setup
  let admin = await pool.query("SELECT id FROM users WHERE role='ADMIN' LIMIT 1");
  let adminId;
  if (admin.rowCount) {
    adminId = admin.rows[0].id;
  } else {
    adminId = randomUUID();
    await pool.query(
      `INSERT INTO users (id, login_id, email, password_hash, role)
       VALUES ($1, 'admin', 'admin@urbanfurniture.local', $2, 'ADMIN')`,
      [adminId, demoPasswordHash]
    );
  }
  console.log(`Admin user ready: ${adminId}`);

  // 2. Demo Users: Exactly 3: One Accountant, One Vendor, One Customer (Linked)
  console.log('Setting up linked Demo Users (Accountant, Vendor A, Customer A)...');

  // 2.1 Demo Accountant
  let accountantUser = await pool.query("SELECT id FROM users WHERE login_id = 'demo.accountant'");
  let accountantId;
  if (accountantUser.rowCount) {
    accountantId = accountantUser.rows[0].id;
    await pool.query(
      "UPDATE users SET password_hash = $1, is_active = true, approval_status = 'APPROVED' WHERE id = $2",
      [demoPasswordHash, accountantId]
    );
  } else {
    accountantId = randomUUID();
    await pool.query(
      `INSERT INTO users (id, login_id, email, password_hash, role, approval_status, is_active)
       VALUES ($1, 'demo.accountant', 'accountant.demo@urbanfurniture.com', $2, 'ACCOUNTANT', 'APPROVED', true)
       ON CONFLICT (login_id) DO UPDATE SET password_hash = $2, role = 'ACCOUNTANT', approval_status = 'APPROVED', is_active = true`,
      [accountantId, demoPasswordHash]
    );
  }
  // Also ensure existing Sandeep accountant user has Demo1234!
  await pool.query(
    "UPDATE users SET password_hash = $1, approval_status = 'APPROVED', is_active = true WHERE login_id = 'Sandeep'",
    [demoPasswordHash]
  );
  console.log(`Demo Accountant ready: ${accountantId} (login: demo.accountant)`);

  // 2.2 Demo Vendor Contact & User (Accountant has the vendors -> created_by = accountantId)
  let vendorAContact = await pool.query("SELECT id FROM contacts WHERE email = 'vendor.a@demo.com'");
  let vendorAContactId;
  if (vendorAContact.rowCount) {
    vendorAContactId = vendorAContact.rows[0].id;
    await pool.query(
      "UPDATE contacts SET created_by = $1, updated_by = $1 WHERE id = $2",
      [accountantId, vendorAContactId]
    );
  } else {
    vendorAContactId = randomUUID();
    await pool.query(
      `INSERT INTO contacts (id, name, type, email, mobile, city, state, pincode, status, created_by, updated_by)
       VALUES ($1, 'Vendor A - Apex Woodcraft & Materials', 'VENDOR', 'vendor.a@demo.com', '9811001100', 'Bengaluru', 'Karnataka', '560001', 'ACTIVE', $2, $2)`,
      [vendorAContactId, accountantId]
    );
  }

  let vendorAUser = await pool.query("SELECT id FROM users WHERE login_id = 'vendorA'");
  let vendorAUserId;
  if (vendorAUser.rowCount) {
    vendorAUserId = vendorAUser.rows[0].id;
    await pool.query(
      "UPDATE users SET contact_id = $1, account_type = 'VENDOR', role = 'CONTACT', password_hash = $2, approval_status = 'APPROVED', is_active = true WHERE id = $3",
      [vendorAContactId, demoPasswordHash, vendorAUserId]
    );
  } else {
    vendorAUserId = randomUUID();
    await pool.query(
      `INSERT INTO users (id, login_id, email, password_hash, role, contact_id, account_type, approval_status, is_active)
       VALUES ($1, 'vendorA', 'vendor.a@demo.com', $2, 'CONTACT', $3, 'VENDOR', 'APPROVED', true)
       ON CONFLICT (login_id) DO UPDATE SET contact_id = $3, account_type = 'VENDOR', password_hash = $2, approval_status = 'APPROVED', is_active = true`,
      [vendorAUserId, demoPasswordHash, vendorAContactId]
    );
  }
  // Also update existing vendor user password if present (without duplicate contact_id)
  await pool.query(
    "UPDATE users SET account_type = 'VENDOR', password_hash = $1, approval_status = 'APPROVED', is_active = true WHERE login_id = 'vendor'",
    [demoPasswordHash]
  );
  console.log(`Demo Vendor ready: contact ${vendorAContactId}, user ${vendorAUserId} (login: vendorA)`);

  // 2.3 Demo Customer Contact & User (Vendor A has the customers -> created_by = vendorAUserId)
  let customerAContact = await pool.query("SELECT id FROM contacts WHERE email = 'customer.a@demo.com'");
  let customerAContactId;
  if (customerAContact.rowCount) {
    customerAContactId = customerAContact.rows[0].id;
    await pool.query(
      "UPDATE contacts SET created_by = $1, updated_by = $1 WHERE id = $2",
      [vendorAUserId, customerAContactId]
    );
  } else {
    customerAContactId = randomUUID();
    await pool.query(
      `INSERT INTO contacts (id, name, type, email, mobile, city, state, pincode, status, created_by, updated_by)
       VALUES ($1, 'Customer A - Horizon Corporate Spaces', 'CUSTOMER', 'customer.a@demo.com', '9822002200', 'Bengaluru', 'Karnataka', '560001', 'ACTIVE', $2, $2)`,
      [customerAContactId, vendorAUserId]
    );
  }

  let customerAUser = await pool.query("SELECT id FROM users WHERE login_id = 'customerA'");
  let customerAUserId;
  if (customerAUser.rowCount) {
    customerAUserId = customerAUser.rows[0].id;
    await pool.query(
      "UPDATE users SET contact_id = $1, account_type = 'CUSTOMER', role = 'CONTACT', password_hash = $2, approval_status = 'APPROVED', is_active = true WHERE id = $3",
      [customerAContactId, demoPasswordHash, customerAUserId]
    );
  } else {
    customerAUserId = randomUUID();
    await pool.query(
      `INSERT INTO users (id, login_id, email, password_hash, role, contact_id, account_type, approval_status, is_active)
       VALUES ($1, 'customerA', 'customer.a@demo.com', $2, 'CONTACT', $3, 'CUSTOMER', 'APPROVED', true)
       ON CONFLICT (login_id) DO UPDATE SET contact_id = $3, account_type = 'CUSTOMER', password_hash = $2, approval_status = 'APPROVED', is_active = true`,
      [customerAUserId, demoPasswordHash, customerAContactId]
    );
  }
  // Also update existing consumer user password if present (without duplicate contact_id)
  await pool.query(
    "UPDATE users SET account_type = 'CUSTOMER', password_hash = $1, approval_status = 'APPROVED', is_active = true WHERE login_id = 'consumer'",
    [demoPasswordHash]
  );
  console.log(`Demo Customer ready: contact ${customerAContactId}, user ${customerAUserId} (login: customerA)`);

  // 3. Product Categories (300)
  console.log('Seeding 300 Product Categories...');
  const categoryIds = [];
  let catIndex = 1;
  while (categoryIds.length < 300) {
    const baseName = CATEGORY_NAMES[(catIndex - 1) % CATEGORY_NAMES.length];
    const suffix = catIndex <= CATEGORY_NAMES.length ? '' : ` Series ${Math.ceil(catIndex / CATEGORY_NAMES.length)}`;
    const catName = `${baseName}${suffix}`;
    const desc = `Commercial and residential grade category for ${catName.toLowerCase()}`;

    const existing = await pool.query('SELECT id FROM product_categories WHERE lower(name) = lower($1)', [catName]);
    if (existing.rowCount) {
      categoryIds.push(existing.rows[0].id);
    } else {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO product_categories (id, name, description, status)
         VALUES ($1, $2, $3, 'ACTIVE')
         ON CONFLICT (lower(name)) DO NOTHING`,
        [id, catName, desc]
      );
      categoryIds.push(id);
    }
    catIndex++;
  }
  console.log(`Product categories ready: ${categoryIds.length}`);

  // 4. Products (300)
  console.log('Seeding 300 Products...');
  const productIds = [];
  const existingProducts = await pool.query('SELECT id FROM products LIMIT 300');
  for (const row of existingProducts.rows) {
    productIds.push(row.id);
  }

  let prodIndex = productIds.length + 1;
  while (productIds.length < 300) {
    const prefix = PRODUCT_PREFIXES[(prodIndex - 1) % PRODUCT_PREFIXES.length];
    const catId = categoryIds[(prodIndex - 1) % categoryIds.length];
    const type = PRODUCT_TYPES[(prodIndex - 1) % PRODUCT_TYPES.length];
    const prodName = `${prefix} Model-${String(prodIndex).padStart(3, '0')}`;
    const purchasePrice = (500 + (prodIndex * 37) % 15000).toFixed(2);
    const salesPrice = (parseFloat(purchasePrice) * 1.45).toFixed(2);
    const id = randomUUID();

    await pool.query(
      `INSERT INTO products (id, name, type, sales_price, purchase_price, category_id, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $7)`,
      [id, prodName, type, salesPrice, purchasePrice, catId, adminId]
    );
    productIds.push(id);
    prodIndex++;
  }
  console.log(`Products ready: ${productIds.length}`);

  // 5. Contacts (300)
  console.log('Seeding 300 Contacts...');
  const contactIds = { CUSTOMER: [customerAContactId], VENDOR: [vendorAContactId], BOTH: [] };
  const existingContacts = await pool.query('SELECT id, type FROM contacts LIMIT 350');
  for (const row of existingContacts.rows) {
    if (row.id !== vendorAContactId && row.id !== customerAContactId) {
      if (contactIds[row.type]) contactIds[row.type].push(row.id);
    }
  }
  let totalContacts = existingContacts.rowCount;
  let contactIndex = totalContacts + 1;

  while (totalContacts < 300) {
    const isCompany = contactIndex % 2 === 0;
    const type = contactIndex % 5 === 0 ? 'BOTH' : (contactIndex % 2 === 0 ? 'VENDOR' : 'CUSTOMER');
    const loc = CITIES[(contactIndex - 1) % CITIES.length];
    let name;
    if (isCompany) {
      const baseComp = COMPANY_NAMES[(contactIndex - 1) % COMPANY_NAMES.length];
      name = contactIndex <= COMPANY_NAMES.length ? baseComp : `${baseComp} Branch ${Math.ceil(contactIndex / COMPANY_NAMES.length)}`;
    } else {
      const basePerson = INDIVIDUAL_NAMES[(contactIndex - 1) % INDIVIDUAL_NAMES.length];
      name = contactIndex <= INDIVIDUAL_NAMES.length ? basePerson : `${basePerson} #${contactIndex}`;
    }
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 15);
    const email = `contact${contactIndex}.${cleanName}@example.com`;
    const mobile = `98${String(10000000 + contactIndex).slice(0, 8)}`;
    const id = randomUUID();
    // Some contacts created by Accountant for demo illustration
    const creator = contactIndex % 3 === 0 ? accountantId : adminId;

    await pool.query(
      `INSERT INTO contacts (id, name, type, email, mobile, city, state, pincode, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9, $9)`,
      [id, name, type, email, mobile, loc.city, loc.state, loc.pincode, creator]
    );
    contactIds[type].push(id);
    totalContacts++;
    contactIndex++;
  }
  // Assign demo.accountant as creator for 15+ contacts (including Vendor A)
  await pool.query(
    'UPDATE contacts SET created_by = $1 WHERE id IN (SELECT id FROM contacts WHERE id != $2 LIMIT 20)',
    [accountantId, customerAContactId]
  );
  console.log(`Contacts ready: ${totalContacts}`);

  // 6. Create Portals for at least 50% of the Contacts (180 out of 300)
  console.log('Generating Portal Accounts for at least 50% of contacts...');
  const allContactsQuery = await pool.query('SELECT id, name, type, email FROM contacts ORDER BY created_at ASC');
  const targetPortals = Math.max(180, Math.ceil(allContactsQuery.rowCount * 0.55));
  let portalsCount = 0;

  for (let i = 0; i < allContactsQuery.rows.length && portalsCount < targetPortals; i++) {
    const c = allContactsQuery.rows[i];
    // Check if user already exists
    const hasUser = await pool.query('SELECT id FROM users WHERE contact_id = $1', [c.id]);
    if (hasUser.rowCount) {
      portalsCount++;
      continue;
    }

    const cleanName = c.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 12);
    const loginId = `portal.${cleanName}${i + 1}`;
    const email = c.email || `${loginId}@urbanfurniture.demo`;
    const accountType = c.type === 'VENDOR' ? 'VENDOR' : 'CUSTOMER';
    const userId = randomUUID();

    const existingCheck = await pool.query('SELECT id FROM users WHERE login_id = $1 OR email = $2', [loginId, email]);
    if (existingCheck.rowCount) continue;

    await pool.query(
      `INSERT INTO users (id, login_id, email, password_hash, role, contact_id, account_type, approval_status, is_active)
       VALUES ($1, $2, $3, $4, 'CONTACT', $5, $6, 'APPROVED', true)
       ON CONFLICT (login_id) DO NOTHING`,
      [userId, loginId, email, demoPasswordHash, c.id, accountType]
    );
    portalsCount++;
  }
  console.log(`Portals ready: ${portalsCount} active portal accounts created.`);

  // 7. Accounts (Chart of Accounts - 300)
  console.log('Seeding 300 Accounts...');
  const accountTypes = [
    { type: 'ASSET', start: 1000, count: 80, prefix: 'Asset' },
    { type: 'LIABILITY', start: 2000, count: 60, prefix: 'Liability' },
    { type: 'CAPITAL', start: 3000, count: 40, prefix: 'Capital' },
    { type: 'INCOME', start: 4000, count: 60, prefix: 'Income' },
    { type: 'EXPENSE', start: 5000, count: 60, prefix: 'Expense' }
  ];

  const allAccountIds = [];
  const accountsByType = { ASSET: [], LIABILITY: [], CAPITAL: [], INCOME: [], EXPENSE: [] };

  for (const group of accountTypes) {
    for (let i = 1; i <= group.count; i++) {
      const code = String(group.start + i);
      const name = `${group.prefix} - Account ${code}`;
      const existing = await pool.query('SELECT id, type FROM accounts WHERE account_code = $1', [code]);
      if (existing.rowCount) {
        allAccountIds.push(existing.rows[0].id);
        accountsByType[existing.rows[0].type].push(existing.rows[0].id);
      } else {
        const id = randomUUID();
        await pool.query(
          `INSERT INTO accounts (id, account_code, account_name, type, status, created_by, updated_by)
           VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $5)
           ON CONFLICT (account_code) DO NOTHING`,
          [id, code, name, group.type, accountantId]
        );
        allAccountIds.push(id);
        accountsByType[group.type].push(id);
      }
    }
  }
  console.log(`Accounts ready: ${allAccountIds.length}`);

  // 8. Journals (300)
  console.log('Seeding 300 Journals...');
  const journalTypes = ['GENERAL', 'SALES', 'PURCHASE', 'BANK', 'CASH'];
  const journalIds = [];
  const existingJournals = await pool.query('SELECT id FROM journals LIMIT 300');
  for (const row of existingJournals.rows) {
    journalIds.push(row.id);
  }
  let journalIndex = journalIds.length + 1;
  while (journalIds.length < 300) {
    const id = randomUUID();
    const type = journalTypes[(journalIndex - 1) % journalTypes.length];
    const name = `${type} Journal - Branch ${String(journalIndex).padStart(3, '0')}`;
    const code = `JRN-${String(journalIndex).padStart(4, '0')}`;
    const existing = await pool.query('SELECT id FROM journals WHERE code = $1', [code]);
    if (existing.rowCount) {
      journalIds.push(existing.rows[0].id);
    } else {
      await pool.query(
        `INSERT INTO journals (id, code, name, type, status, created_by, updated_by)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $5)
         ON CONFLICT (code) DO NOTHING`,
        [id, code, name, type, accountantId]
      );
      journalIds.push(id);
    }
    journalIndex++;
  }
  console.log(`Journals ready: ${journalIds.length}`);

  // 9. Analytic Accounts (300)
  console.log('Seeding 300 Analytic Accounts...');
  const analyticIds = [];
  const existingAnalytics = await pool.query('SELECT id FROM analytic_accounts LIMIT 300');
  for (const row of existingAnalytics.rows) {
    analyticIds.push(row.id);
  }
  let analyticIndex = analyticIds.length + 1;
  while (analyticIds.length < 300) {
    const id = randomUUID();
    const code = `CC-${String(analyticIndex).padStart(4, '0')}`;
    const name = `Cost Center ${code} - Operational Unit`;
    const existing = await pool.query('SELECT id FROM analytic_accounts WHERE code = $1', [code]);
    if (existing.rowCount) {
      analyticIds.push(existing.rows[0].id);
    } else {
      await pool.query(
        `INSERT INTO analytic_accounts (id, code, name, status, created_by, updated_by)
         VALUES ($1, $2, $3, 'ACTIVE', $4, $4)
         ON CONFLICT (code) DO NOTHING`,
        [id, code, name, accountantId]
      );
      analyticIds.push(id);
    }
    analyticIndex++;
  }
  console.log(`Analytic accounts ready: ${analyticIds.length}`);

  // 10. Budgets (300) - Associate at least 15 with demo.accountant
  console.log('Seeding 300 Budgets (with demo.accountant linkages)...');
  const budgetCount = await pool.query('SELECT COUNT(*)::int AS count FROM budgets');
  let currentBudgets = budgetCount.rows[0].count;
  let budgetIndex = currentBudgets + 1;

  while (currentBudgets < 300) {
    const id = randomUUID();
    const name = `Operating Budget Q${((budgetIndex - 1) % 4) + 1} - Division ${budgetIndex}`;
    const anId = analyticIds[(budgetIndex - 1) % analyticIds.length];
    const amount = (25000 + (budgetIndex * 1500) % 500000).toFixed(2);
    const year = 2026;
    const q = ((budgetIndex - 1) % 4);
    const sMonth = q * 3 + 1;
    const eMonth = sMonth + 2;
    const startDate = `${year}-${String(sMonth).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(eMonth).padStart(2, '0')}-28`;
    // Link at least 15 budgets to demo.accountant
    const assignedUser = budgetIndex <= 20 ? accountantId : adminId;

    await pool.query(
      `INSERT INTO budgets (id, name, analytic_account_id, responsible_user_id, period_start, period_end, planned_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')`,
      [id, name, anId, assignedUser, startDate, endDate, amount]
    );
    currentBudgets++;
    budgetIndex++;
  }
  // Ensure at least 15 existing budgets are also assigned to demo.accountant
  await pool.query(
    `UPDATE budgets SET responsible_user_id = $1 WHERE id IN (SELECT id FROM budgets LIMIT 20)`,
    [accountantId]
  );
  console.log(`Budgets ready: ${currentBudgets}`);

  // 11. Journal Entries (300) - Associate at least 15 with demo.accountant
  console.log('Seeding 300 Journal Entries (with demo.accountant postings)...');
  const jEntryQuery = await pool.query('SELECT COUNT(*)::int AS count FROM journal_entries');
  let jEntryCount = jEntryQuery.rows[0].count;
  let jEntryIndex = jEntryCount + 1;

  while (jEntryCount < 300) {
    const id = randomUUID();
    const entryNumber = `JE-SEED-${String(jEntryIndex).padStart(6, '0')}`;
    const journalId = journalIds[(jEntryIndex - 1) % journalIds.length];
    const month = ((jEntryIndex - 1) % 8) + 1;
    const day = ((jEntryIndex * 3) % 27) + 1;
    const entryDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const debitAcc = accountsByType.EXPENSE[(jEntryIndex - 1) % accountsByType.EXPENSE.length];
    const creditAcc = accountsByType.ASSET[(jEntryIndex - 1) % accountsByType.ASSET.length];
    const anId = analyticIds[(jEntryIndex - 1) % analyticIds.length];
    const amount = (1500 + (jEntryIndex * 75) % 25000).toFixed(2);
    const status = jEntryIndex % 5 === 0 ? 'DRAFT' : 'POSTED';
    const creator = jEntryIndex <= 20 ? accountantId : adminId;

    await pool.query(
      `INSERT INTO journal_entries (id, entry_number, journal_id, entry_date, reference, description, status, created_by_id, posted_by_id, posted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        entryNumber,
        journalId,
        entryDate,
        `REF-${String(jEntryIndex).padStart(5, '0')}`,
        `Operational expense booking #${jEntryIndex}`,
        status,
        creator,
        status === 'POSTED' ? creator : null,
        status === 'POSTED' ? new Date() : null
      ]
    );

    // Balanced lines
    await pool.query(
      `INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, description, debit, credit, analytic_account_id, line_order)
       VALUES ($1, $2, $3, $4, $5, 0, $6, 1)`,
      [randomUUID(), id, debitAcc, `Debit operational cost`, amount, anId]
    );
    await pool.query(
      `INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, description, debit, credit, analytic_account_id, line_order)
       VALUES ($1, $2, $3, $4, 0, $5, NULL, 2)`,
      [randomUUID(), id, creditAcc, `Credit payment source`, amount]
    );

    jEntryCount++;
    jEntryIndex++;
  }
  // Ensure at least 20 journal entries are created/posted by demo.accountant
  await pool.query(
    `UPDATE journal_entries SET created_by_id = $1::uuid, posted_by_id = CASE WHEN status = 'POSTED' THEN $1::uuid ELSE NULL END WHERE id IN (SELECT id FROM journal_entries LIMIT 25)`,
    [accountantId]
  );
  console.log(`Journal entries ready: ${jEntryCount}`);

  // 12. Vendors & Customers lists (including Vendor A and Customer A)
  const vendors = [vendorAContactId, ...contactIds.VENDOR.filter((id) => id !== vendorAContactId), ...contactIds.BOTH];
  const customers = [customerAContactId, ...contactIds.CUSTOMER.filter((id) => id !== customerAContactId), ...contactIds.BOTH];

  // 13. Purchase Orders: At least 10 for Vendor A + guarantee every single vendor contact has transactions!
  console.log('Seeding Purchase Orders (with Vendor A & all vendors)...');
  const poCount = await pool.query('SELECT COUNT(*)::int AS count FROM purchase_orders');
  let purchaseOrdersCount = poCount.rows[0].count;
  let poIndex = purchaseOrdersCount + 1;

  // First: Ensure Vendor A has at least 12 Purchase Orders created by demo.accountant
  const vendorAPOs = await pool.query('SELECT COUNT(*)::int AS count FROM purchase_orders WHERE vendor_id = $1', [vendorAContactId]);
  let vAPoCount = vendorAPOs.rows[0].count;
  while (vAPoCount < 12) {
    const id = randomUUID();
    const orderNumber = `PO-VEND-A-${String(vAPoCount + 1).padStart(4, '0')}`;
    const month = ((vAPoCount % 8) + 1);
    const day = ((vAPoCount * 2) % 25) + 1;
    const orderDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const expDate = `2026-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const p1 = productIds[(vAPoCount * 2) % productIds.length];
    const q1 = ((vAPoCount % 5) + 3);
    const u1 = 2500 + (vAPoCount * 120);
    const sub = q1 * u1;
    const tax = sub * 0.18;
    const tot = sub + tax;

    await pool.query(
      `INSERT INTO purchase_orders (id, order_number, vendor_id, order_date, expected_date, reference, notes, status, subtotal, tax_amount, total_amount, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED', $8, $9, $10, $11)`,
      [id, orderNumber, vendorAContactId, orderDate, expDate, `PO-VEND-A-REF-${vAPoCount + 1}`, `Raw timber & hardware procurement via Vendor A`, sub.toFixed(2), tax.toFixed(2), tot.toFixed(2), accountantId]
    );
    await pool.query(
      `INSERT INTO purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
       VALUES ($1, $2, $3, $4, $5, $6, 18, $7, $8, $9, 1)`,
      [randomUUID(), id, p1, 'Premium Grade Raw Materials from Vendor A', q1, u1.toFixed(2), tax.toFixed(2), sub.toFixed(2), tot.toFixed(2)]
    );
    vAPoCount++;
    purchaseOrdersCount++;
  }

  // Next: Ensure ALL remaining vendors have at least one purchase order
  for (let i = 0; i < vendors.length; i++) {
    const vId = vendors[i];
    const check = await pool.query('SELECT 1 FROM purchase_orders WHERE vendor_id = $1 LIMIT 1', [vId]);
    if (!check.rowCount) {
      const id = randomUUID();
      const orderNumber = `PO-SEED-${String(poIndex).padStart(6, '0')}`;
      const month = ((i % 8) + 1);
      const day = ((i * 2) % 27) + 1;
      const orderDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const expDate = `2026-${String(month === 12 ? 12 : month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const p1 = productIds[i % productIds.length];
      const q1 = ((i % 6) + 1);
      const u1 = 1200 + (i * 35) % 4000;
      const sub = q1 * u1;
      const tax = sub * 0.18;
      const tot = sub + tax;

      await pool.query(
        `INSERT INTO purchase_orders (id, order_number, vendor_id, order_date, expected_date, reference, notes, status, subtotal, tax_amount, total_amount, created_by_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED', $8, $9, $10, $11)`,
        [id, orderNumber, vId, orderDate, expDate, `POREF-${poIndex}`, `Standard procurement order #${poIndex}`, sub.toFixed(2), tax.toFixed(2), tot.toFixed(2), accountantId]
      );
      await pool.query(
        `INSERT INTO purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
         VALUES ($1, $2, $3, $4, $5, $6, 18, $7, $8, $9, 1)`,
        [randomUUID(), id, p1, 'Component materials unit', q1, u1.toFixed(2), tax.toFixed(2), sub.toFixed(2), tot.toFixed(2)]
      );
      poIndex++;
      purchaseOrdersCount++;
    }
  }
  console.log(`Purchase orders ready: ${purchaseOrdersCount} (Vendor A POs: ${vAPoCount})`);

  // 14. Vendor Bills: At least 10 for Vendor A + guarantee every single vendor has at least 1 bill!
  console.log('Seeding Vendor Bills (with Vendor A & all vendors)...');
  const vbCount = await pool.query('SELECT COUNT(*)::int AS count FROM vendor_bills');
  let vendorBillsCount = vbCount.rows[0].count;
  let vbIndex = vendorBillsCount + 1;

  // Ensure Vendor A has at least 12 Vendor Bills created by demo.accountant
  const vendorAVBs = await pool.query('SELECT COUNT(*)::int AS count FROM vendor_bills WHERE vendor_id = $1', [vendorAContactId]);
  let vAVbCount = vendorAVBs.rows[0].count;
  const vendorAPaidBillIds = [];
  while (vAVbCount < 12) {
    const id = randomUUID();
    const billNumber = `VB-VEND-A-${String(vAVbCount + 1).padStart(4, '0')}`;
    const month = ((vAVbCount % 8) + 1);
    const day = ((vAVbCount * 2) % 25) + 1;
    const invDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dueDate = `2026-${String(month).padStart(2, '0')}-${String(Math.min(day + 15, 28)).padStart(2, '0')}`;
    const p1 = productIds[(vAVbCount * 3) % productIds.length];
    const q1 = ((vAVbCount % 4) + 2);
    const u1 = 2800 + (vAVbCount * 110);
    const sub = q1 * u1;
    const tax = sub * 0.18;
    const tot = sub + tax;
    const paymentStatus = vAVbCount % 2 === 0 ? 'PAID' : 'UNPAID';

    await pool.query(
      `INSERT INTO vendor_bills (id, bill_number, vendor_id, vendor_invoice_number, invoice_date, due_date, reference, notes, subtotal, tax_amount, total_amount, payment_status, status, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'POSTED', $13)`,
      [id, billNumber, vendorAContactId, `INV-VA-${vAVbCount + 1}`, invDate, dueDate, `REF-VA-${vAVbCount + 1}`, `Vendor A supplier materials invoice`, sub.toFixed(2), tax.toFixed(2), tot.toFixed(2), paymentStatus, accountantId]
    );
    await pool.query(
      `INSERT INTO vendor_bill_items (id, vendor_bill_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
       VALUES ($1, $2, $3, $4, $5, $6, 18, $7, $8, $9, 1)`,
      [randomUUID(), id, p1, 'Timber boards & joinery hardware from Vendor A', q1, u1.toFixed(2), tax.toFixed(2), sub.toFixed(2), tot.toFixed(2)]
    );
    if (paymentStatus === 'PAID') {
      vendorAPaidBillIds.push({ id, amount: tot, date: invDate, contactId: vendorAContactId });
    }
    vAVbCount++;
    vendorBillsCount++;
  }

  // Ensure ALL remaining vendors have at least one bill
  for (let i = 0; i < vendors.length; i++) {
    const vId = vendors[i];
    const check = await pool.query('SELECT 1 FROM vendor_bills WHERE vendor_id = $1 LIMIT 1', [vId]);
    if (!check.rowCount) {
      const id = randomUUID();
      const billNumber = `VB-SEED-${String(vbIndex).padStart(6, '0')}`;
      const month = ((i % 8) + 1);
      const day = ((i * 3) % 25) + 1;
      const invDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dueDate = `2026-${String(month).padStart(2, '0')}-${String(Math.min(day + 15, 28)).padStart(2, '0')}`;
      const p1 = productIds[(i * 2) % productIds.length];
      const q1 = ((i % 5) + 1);
      const u1 = 1500 + (i * 20) % 3500;
      const sub = q1 * u1;
      const tax = sub * 0.18;
      const tot = sub + tax;

      await pool.query(
        `INSERT INTO vendor_bills (id, bill_number, vendor_id, vendor_invoice_number, invoice_date, due_date, reference, notes, subtotal, tax_amount, total_amount, payment_status, status, created_by_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PAID', 'POSTED', $12)`,
        [id, billNumber, vId, `INV-V-${vbIndex}`, invDate, dueDate, `REF-VB-${vbIndex}`, `Supplier invoice #${vbIndex}`, sub.toFixed(2), tax.toFixed(2), tot.toFixed(2), accountantId]
      );
      await pool.query(
        `INSERT INTO vendor_bill_items (id, vendor_bill_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
         VALUES ($1, $2, $3, $4, $5, $6, 18, $7, $8, $9, 1)`,
        [randomUUID(), id, p1, 'Procured material supplies', q1, u1.toFixed(2), tax.toFixed(2), sub.toFixed(2), tot.toFixed(2)]
      );
      vbIndex++;
      vendorBillsCount++;
    }
  }
  console.log(`Vendor bills ready: ${vendorBillsCount} (Vendor A Bills: ${vAVbCount})`);

  // 15. Sales Orders: At least 10 for Customer A + guarantee every single customer has at least 1 order!
  console.log('Seeding Sales Orders (with Customer A & all customers)...');
  const soCount = await pool.query('SELECT COUNT(*)::int AS count FROM sales_orders');
  let salesOrdersCount = soCount.rows[0].count;
  let soIndex = salesOrdersCount + 1;

  // Ensure Customer A has at least 12 Sales Orders created by demo.accountant
  const customerASOs = await pool.query('SELECT COUNT(*)::int AS count FROM sales_orders WHERE customer_id = $1', [customerAContactId]);
  let cASoCount = customerASOs.rows[0].count;
  while (cASoCount < 12) {
    const id = randomUUID();
    const orderNumber = `SO-CUST-A-${String(cASoCount + 1).padStart(4, '0')}`;
    const month = ((cASoCount % 8) + 1);
    const day = ((cASoCount * 2) % 25) + 1;
    const orderDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const p1 = productIds[(cASoCount * 2 + 1) % productIds.length];
    const q1 = ((cASoCount % 4) + 2);
    const u1 = 4500 + (cASoCount * 180);
    const sub = q1 * u1;
    const tax = sub * 0.18;
    const tot = sub + tax;

    await pool.query(
      `INSERT INTO sales_orders (id, order_number, customer_id, order_date, reference, notes, status, subtotal, tax_amount, total_amount, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', $7, $8, $9, $10)`,
      [id, orderNumber, customerAContactId, orderDate, `SO-CUST-A-REF-${cASoCount + 1}`, `Corporate furnishing order for Customer A (Supplied via Vendor A materials)`, sub.toFixed(2), tax.toFixed(2), tot.toFixed(2), accountantId]
    );
    await pool.query(
      `INSERT INTO sales_order_items (id, sales_order_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
       VALUES ($1, $2, $3, $4, $5, $6, 18, $7, $8, $9, 1)`,
      [randomUUID(), id, p1, 'Custom Executive Workspace Installation for Customer A', q1, u1.toFixed(2), tax.toFixed(2), sub.toFixed(2), tot.toFixed(2)]
    );
    cASoCount++;
    salesOrdersCount++;
  }

  // Ensure ALL remaining customers have at least one sales order
  for (let i = 0; i < customers.length; i++) {
    const cId = customers[i];
    const check = await pool.query('SELECT 1 FROM sales_orders WHERE customer_id = $1 LIMIT 1', [cId]);
    if (!check.rowCount) {
      const id = randomUUID();
      const orderNumber = `SO-SEED-${String(soIndex).padStart(6, '0')}`;
      const month = ((i % 8) + 1);
      const day = ((i * 2) % 27) + 1;
      const orderDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const p1 = productIds[(i * 3) % productIds.length];
      const q1 = ((i % 4) + 1);
      const u1 = 2500 + (i * 45) % 6000;
      const sub = q1 * u1;
      const tax = sub * 0.18;
      const tot = sub + tax;

      await pool.query(
        `INSERT INTO sales_orders (id, order_number, customer_id, order_date, reference, notes, status, subtotal, tax_amount, total_amount, created_by_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', $7, $8, $9, $10)`,
        [id, orderNumber, cId, orderDate, `SOREF-${soIndex}`, `Client order #${soIndex}`, sub.toFixed(2), tax.toFixed(2), tot.toFixed(2), accountantId]
      );
      await pool.query(
        `INSERT INTO sales_order_items (id, sales_order_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
         VALUES ($1, $2, $3, $4, $5, $6, 18, $7, $8, $9, 1)`,
        [randomUUID(), id, p1, 'Manufactured office furniture set', q1, u1.toFixed(2), tax.toFixed(2), sub.toFixed(2), tot.toFixed(2)]
      );
      soIndex++;
      salesOrdersCount++;
    }
  }
  console.log(`Sales orders ready: ${salesOrdersCount} (Customer A SOs: ${cASoCount})`);

  // 16. Customer Invoices: At least 10 for Customer A + guarantee every single customer has at least 1 invoice!
  console.log('Seeding Customer Invoices (with Customer A & all customers)...');
  const ciCount = await pool.query('SELECT COUNT(*)::int AS count FROM customer_invoices');
  let customerInvoicesCount = ciCount.rows[0].count;
  let ciIndex = customerInvoicesCount + 1;

  // Ensure Customer A has at least 12 Customer Invoices created by demo.accountant
  const customerACIs = await pool.query('SELECT COUNT(*)::int AS count FROM customer_invoices WHERE customer_id = $1', [customerAContactId]);
  let cACiCount = customerACIs.rows[0].count;
  const customerAPaidInvoiceIds = [];
  while (cACiCount < 12) {
    const id = randomUUID();
    const invoiceNumber = `INV-CUST-A-${String(cACiCount + 1).padStart(4, '0')}`;
    const month = ((cACiCount % 8) + 1);
    const day = ((cACiCount * 2) % 25) + 1;
    const invDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dueDate = `2026-${String(month).padStart(2, '0')}-${String(Math.min(day + 30, 28)).padStart(2, '0')}`;
    const p1 = productIds[(cACiCount * 2 + 2) % productIds.length];
    const q1 = ((cACiCount % 4) + 2);
    const u1 = 5200 + (cACiCount * 210);
    const sub = q1 * u1;
    const tax = sub * 0.18;
    const tot = sub + tax;
    const paymentStatus = cACiCount % 2 === 0 ? 'PAID' : 'UNPAID';

    await pool.query(
      `INSERT INTO customer_invoices (id, invoice_number, customer_id, invoice_date, due_date, reference, notes, subtotal, tax_amount, total_amount, status, payment_status, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'POSTED', $11, $12)`,
      [id, invoiceNumber, customerAContactId, invDate, dueDate, `REF-CA-${cACiCount + 1}`, `Commercial project invoice for Customer A`, sub.toFixed(2), tax.toFixed(2), tot.toFixed(2), paymentStatus, accountantId]
    );
    await pool.query(
      `INSERT INTO customer_invoice_items (id, customer_invoice_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
       VALUES ($1, $2, $3, $4, $5, $6, 18, $7, $8, $9, 1)`,
      [randomUUID(), id, p1, 'Modular workstations and ergonomic seating for Customer A', q1, u1.toFixed(2), tax.toFixed(2), sub.toFixed(2), tot.toFixed(2)]
    );
    if (paymentStatus === 'PAID') {
      customerAPaidInvoiceIds.push({ id, amount: tot, date: invDate, contactId: customerAContactId });
    }
    cACiCount++;
    customerInvoicesCount++;
  }

  // Ensure ALL remaining customers have at least one invoice
  for (let i = 0; i < customers.length; i++) {
    const cId = customers[i];
    const check = await pool.query('SELECT 1 FROM customer_invoices WHERE customer_id = $1 LIMIT 1', [cId]);
    if (!check.rowCount) {
      const id = randomUUID();
      const invoiceNumber = `INV-SEED-${String(ciIndex).padStart(6, '0')}`;
      const month = ((i % 8) + 1);
      const day = ((i * 3) % 25) + 1;
      const invDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dueDate = `2026-${String(month).padStart(2, '0')}-${String(Math.min(day + 30, 28)).padStart(2, '0')}`;
      const p1 = productIds[(i * 3) % productIds.length];
      const q1 = ((i % 3) + 1);
      const u1 = 3000 + (i * 40) % 7000;
      const sub = q1 * u1;
      const tax = sub * 0.18;
      const tot = sub + tax;

      await pool.query(
        `INSERT INTO customer_invoices (id, invoice_number, customer_id, invoice_date, due_date, reference, notes, subtotal, tax_amount, total_amount, status, payment_status, created_by_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'POSTED', 'PAID', $11)`,
        [id, invoiceNumber, cId, invDate, dueDate, `REFCUST-${ciIndex}`, `Commercial receivable invoice #${ciIndex}`, sub.toFixed(2), tax.toFixed(2), tot.toFixed(2), accountantId]
      );
      await pool.query(
        `INSERT INTO customer_invoice_items (id, customer_invoice_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
         VALUES ($1, $2, $3, $4, $5, $6, 18, $7, $8, $9, 1)`,
        [randomUUID(), id, p1, 'Delivered and assembled office furniture', q1, u1.toFixed(2), tax.toFixed(2), sub.toFixed(2), tot.toFixed(2)]
      );
      ciIndex++;
      customerInvoicesCount++;
    }
  }
  console.log(`Customer invoices ready: ${customerInvoicesCount} (Customer A Invoices: ${cACiCount})`);

  // 17. Seed Payments (Associated with demo.accountant)
  console.log('Seeding Payments (associated with demo.accountant)...');
  let payIndex = 1;

  // Payments for Vendor A bills
  for (const item of vendorAPaidBillIds) {
    const existing = await pool.query('SELECT id FROM payments WHERE vendor_bill_id = $1', [item.id]);
    if (!existing.rowCount) {
      await pool.query(
        `INSERT INTO payments (id, payment_number, type, contact_id, vendor_bill_id, payment_date, amount, method, reference, notes, status, created_by_id)
         VALUES ($1, $2, 'VENDOR', $3, $4, $5, $6, 'BANK', $7, $8, 'POSTED', $9)`,
        [
          randomUUID(),
          `PAY-VEND-A-${String(payIndex).padStart(4, '0')}`,
          item.contactId,
          item.id,
          item.date,
          item.amount.toFixed(2),
          `REF-PAY-VA-${payIndex}`,
          `Bank settlement to Vendor A`,
          accountantId
        ]
      );
      payIndex++;
    }
  }

  // Payments for Customer A invoices
  for (const item of customerAPaidInvoiceIds) {
    const existing = await pool.query('SELECT id FROM payments WHERE customer_invoice_id = $1', [item.id]);
    if (!existing.rowCount) {
      await pool.query(
        `INSERT INTO payments (id, payment_number, type, contact_id, customer_invoice_id, payment_date, amount, method, reference, notes, status, created_by_id)
         VALUES ($1, $2, 'CUSTOMER', $3, $4, $5, $6, 'BANK', $7, $8, 'POSTED', $9)`,
        [
          randomUUID(),
          `PAY-CUST-A-${String(payIndex).padStart(4, '0')}`,
          item.contactId,
          item.id,
          item.date,
          item.amount.toFixed(2),
          `REF-PAY-CA-${payIndex}`,
          `Customer A invoice payment received via Bank Transfer`,
          accountantId
        ]
      );
      payIndex++;
    }
  }

  // Add more payments so demo.accountant has 15+ payments
  const otherPaidInvoices = await pool.query(`SELECT id, customer_id, total_amount, invoice_date FROM customer_invoices WHERE payment_status = 'PAID' AND id NOT IN (SELECT customer_invoice_id FROM payments WHERE customer_invoice_id IS NOT NULL) LIMIT 10`);
  for (const inv of otherPaidInvoices.rows) {
    await pool.query(
      `INSERT INTO payments (id, payment_number, type, contact_id, customer_invoice_id, payment_date, amount, method, reference, notes, status, created_by_id)
       VALUES ($1, $2, 'CUSTOMER', $3, $4, $5, $6, 'BANK', $7, $8, 'POSTED', $9)`,
      [
        randomUUID(),
        `PAY-IN-${String(payIndex).padStart(5, '0')}`,
        inv.customer_id,
        inv.id,
        inv.invoice_date,
        Number(inv.total_amount).toFixed(2),
        `REFPAY-${payIndex}`,
        `Payment processed by accountant`,
        accountantId
      ]
    );
    payIndex++;
  }
  console.log(`Payments recorded: ${payIndex - 1}`);

  // 18. Final verification: Check 100% of contacts have at least 1 transaction!
  const txCheck = await pool.query(`
    SELECT count(DISTINCT c.id)::int AS count FROM contacts c
    WHERE EXISTS (SELECT 1 FROM purchase_orders po WHERE po.vendor_id = c.id)
       OR EXISTS (SELECT 1 FROM vendor_bills vb WHERE vb.vendor_id = c.id)
       OR EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = c.id)
       OR EXISTS (SELECT 1 FROM customer_invoices ci WHERE ci.customer_id = c.id)
  `);
  console.log(`Verification: ${txCheck.rows[0].count} / ${allContactsQuery.rowCount} contacts have transactions!`);

  console.log('--- All Seed & Demo Data Generated Successfully! ---');
}

seed300()
  .catch((err) => {
    console.error('Seed 300 failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
