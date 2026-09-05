const { randomUUID } = require('crypto');
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
  console.log('--- Starting 300 Seed Data Generation ---');

  // 1. Get or create Admin user ID
  let admin = await pool.query("SELECT id FROM users WHERE role='ADMIN' LIMIT 1");
  let adminId;
  if (admin.rowCount) {
    adminId = admin.rows[0].id;
  } else {
    adminId = randomUUID();
    await pool.query(
      `INSERT INTO users (id, login_id, email, password_hash, role)
       VALUES ($1, 'admin', 'admin@urbanfurniture.local', '$2a$10$dummyhashnotusedhere', 'ADMIN')`,
      [adminId]
    );
  }
  console.log(`Using admin user ID: ${adminId}`);

  // 2. Product Categories (300)
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

  // 3. Products (300)
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

  // 4. Contacts (300)
  console.log('Seeding 300 Contacts...');
  const contactIds = { CUSTOMER: [], VENDOR: [], BOTH: [] };
  const existingContacts = await pool.query('SELECT id, type FROM contacts LIMIT 300');
  for (const row of existingContacts.rows) {
    if (contactIds[row.type]) contactIds[row.type].push(row.id);
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

    await pool.query(
      `INSERT INTO contacts (id, name, type, email, mobile, city, state, pincode, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9, $9)`,
      [id, name, type, email, mobile, loc.city, loc.state, loc.pincode, adminId]
    );
    contactIds[type].push(id);
    totalContacts++;
    contactIndex++;
  }
  console.log(`Contacts ready: ${totalContacts}`);

  // 5. Accounts (Chart of Accounts - 300)
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
          `INSERT INTO accounts (id, account_code, account_name, type, status)
           VALUES ($1, $2, $3, $4, 'ACTIVE')
           ON CONFLICT (account_code) DO NOTHING`,
          [id, code, name, group.type]
        );
        allAccountIds.push(id);
        accountsByType[group.type].push(id);
      }
    }
  }
  // Ensure default base accounts exist
  const baseAccounts = [
    { code: '1001', name: 'Cash', type: 'ASSET' },
    { code: '1002', name: 'Bank', type: 'ASSET' },
    { code: '1003', name: 'Debtors', type: 'ASSET' },
    { code: '2001', name: 'Creditors', type: 'LIABILITY' },
    { code: '2002', name: 'Output Tax Payable', type: 'LIABILITY' },
    { code: '3001', name: 'Owner Capital', type: 'CAPITAL' },
    { code: '4001', name: 'Sales Income', type: 'INCOME' },
    { code: '5001', name: 'Purchase Expense', type: 'EXPENSE' }
  ];
  for (const a of baseAccounts) {
    const ex = await pool.query('SELECT id FROM accounts WHERE account_code = $1', [a.code]);
    if (!ex.rowCount) {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO accounts (id, account_code, account_name, type, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         ON CONFLICT (account_code) DO NOTHING`,
        [id, a.code, a.name, a.type]
      );
      allAccountIds.push(id);
      accountsByType[a.type].push(id);
    }
  }
  console.log(`Accounts ready: ${allAccountIds.length}`);

  // 6. Journals (300)
  console.log('Seeding 300 Journals...');
  const journalTypes = ['SALES', 'PURCHASE', 'BANK', 'CASH'];
  const journalIds = [];
  const existingJournals = await pool.query('SELECT id FROM journals LIMIT 300');
  for (const r of existingJournals.rows) journalIds.push(r.id);

  let jIndex = journalIds.length + 1;
  while (journalIds.length < 300) {
    const type = journalTypes[(jIndex - 1) % journalTypes.length];
    const loc = CITIES[(jIndex - 1) % CITIES.length];
    const name = `${loc.city} ${type.charAt(0) + type.slice(1).toLowerCase()} Journal #${Math.ceil(jIndex / CITIES.length)}`;
    const defaultAccId = type === 'SALES' ? accountsByType.INCOME[0] :
                         type === 'PURCHASE' ? accountsByType.EXPENSE[0] :
                         accountsByType.ASSET[0];

    const ex = await pool.query('SELECT id FROM journals WHERE lower(name) = lower($1)', [name]);
    if (ex.rowCount) {
      journalIds.push(ex.rows[0].id);
    } else {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO journals (id, name, type, default_account_id, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         ON CONFLICT (lower(name)) DO NOTHING`,
        [id, name, type, defaultAccId]
      );
      journalIds.push(id);
    }
    jIndex++;
  }
  console.log(`Journals ready: ${journalIds.length}`);

  // 7. Analytic Accounts (300)
  console.log('Seeding 300 Analytic Accounts...');
  const analyticIds = [];
  const existingAnalytic = await pool.query('SELECT id FROM analytic_accounts LIMIT 300');
  for (const r of existingAnalytic.rows) analyticIds.push(r.id);

  let anIndex = analyticIds.length + 1;
  while (analyticIds.length < 300) {
    const type = anIndex % 2 === 0 ? 'EXPENSE' : 'INCOME';
    const name = `Cost Center CC-${String(anIndex).padStart(4, '0')} (${type === 'INCOME' ? 'Revenue Unit' : 'Ops Cost'})`;

    const ex = await pool.query('SELECT id FROM analytic_accounts WHERE lower(name) = lower($1)', [name]);
    if (ex.rowCount) {
      analyticIds.push(ex.rows[0].id);
    } else {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO analytic_accounts (id, name, type, status)
         VALUES ($1, $2, $3, 'ACTIVE')
         ON CONFLICT (lower(name)) DO NOTHING`,
        [id, name, type]
      );
      analyticIds.push(id);
    }
    anIndex++;
  }
  console.log(`Analytic accounts ready: ${analyticIds.length}`);

  // 8. Budgets (300)
  console.log('Seeding 300 Budgets...');
  const budgetCount = await pool.query('SELECT COUNT(*)::int AS count FROM budgets');
  let bCount = budgetCount.rows[0].count;
  let bIndex = bCount + 1;

  while (bCount < 300) {
    const anId = analyticIds[(bIndex - 1) % analyticIds.length];
    const name = `Operational Budget FY26-B${String(bIndex).padStart(3, '0')}`;
    const plannedAmount = (15000 + (bIndex * 1250) % 250000).toFixed(2);
    const startMonth = ((bIndex - 1) % 12) + 1;
    const periodStart = `2026-${String(startMonth).padStart(2, '0')}-01`;
    const periodEnd = `2026-12-31`;
    const id = randomUUID();

    await pool.query(
      `INSERT INTO budgets (id, name, period_start, period_end, planned_amount, responsible_user_id, analytic_account_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')`,
      [id, name, periodStart, periodEnd, plannedAmount, adminId, anId]
    );
    bCount++;
    bIndex++;
  }
  console.log(`Budgets ready: ${bCount}`);

  // 9. Journal Entries & Balanced Lines (300)
  console.log('Seeding 300 Journal Entries with Balanced Double-Entry Lines...');
  const jeCount = await pool.query('SELECT COUNT(*)::int AS count FROM journal_entries');
  let jEntryCount = jeCount.rows[0].count;
  let jEntryIndex = jEntryCount + 1;

  while (jEntryCount < 300) {
    const id = randomUUID();
    const entryNumber = `JE-SEED-${String(jEntryIndex).padStart(6, '0')}`;
    const journalId = journalIds[(jEntryIndex - 1) % journalIds.length];
    const month = ((jEntryIndex - 1) % 8) + 1;
    const day = ((jEntryIndex * 3) % 27) + 1;
    const entryDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status = jEntryIndex % 3 === 0 ? 'DRAFT' : 'POSTED';
    const amount = (2500 + (jEntryIndex * 175) % 45000).toFixed(2);

    // One debit account, one credit account
    const debitAcc = accountsByType.EXPENSE[(jEntryIndex - 1) % accountsByType.EXPENSE.length] || allAccountIds[0];
    const creditAcc = accountsByType.ASSET[(jEntryIndex - 1) % accountsByType.ASSET.length] || allAccountIds[1];
    const anId = analyticIds[(jEntryIndex - 1) % analyticIds.length];

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
        adminId,
        status === 'POSTED' ? adminId : null,
        status === 'POSTED' ? new Date() : null
      ]
    );

    // Balanced lines: Debit
    await pool.query(
      `INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, description, debit, credit, analytic_account_id, line_order)
       VALUES ($1, $2, $3, $4, $5, 0, $6, 1)`,
      [randomUUID(), id, debitAcc, `Debit operational cost`, amount, anId]
    );

    // Balanced lines: Credit
    await pool.query(
      `INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, description, debit, credit, analytic_account_id, line_order)
       VALUES ($1, $2, $3, $4, 0, $5, NULL, 2)`,
      [randomUUID(), id, creditAcc, `Credit payment source`, amount]
    );

    jEntryCount++;
    jEntryIndex++;
  }
  console.log(`Journal entries ready: ${jEntryCount}`);

  // Vendors and Customers lists
  const vendors = [...contactIds.VENDOR, ...contactIds.BOTH];
  const customers = [...contactIds.CUSTOMER, ...contactIds.BOTH];

  // 10. Purchase Orders & Items (300)
  console.log('Seeding 300 Purchase Orders...');
  const poCount = await pool.query('SELECT COUNT(*)::int AS count FROM purchase_orders');
  let purchaseOrdersCount = poCount.rows[0].count;
  let poIndex = purchaseOrdersCount + 1;

  while (purchaseOrdersCount < 300) {
    const id = randomUUID();
    const orderNumber = `PO-SEED-${String(poIndex).padStart(6, '0')}`;
    const vendorId = vendors[(poIndex - 1) % vendors.length];
    const month = ((poIndex - 1) % 8) + 1;
    const day = ((poIndex * 2) % 27) + 1;
    const orderDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const expMonth = month === 12 ? 12 : month + 1;
    const expectedDate = `2026-${String(expMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status = poIndex % 4 === 0 ? 'DRAFT' : (poIndex % 4 === 1 ? 'CANCELLED' : 'CONFIRMED');

    // 2 line items
    const p1 = productIds[(poIndex * 2 - 2) % productIds.length];
    const p2 = productIds[(poIndex * 2 - 1) % productIds.length];
    const q1 = ((poIndex % 10) + 1);
    const u1 = 1200 + (poIndex * 45) % 5000;
    const taxRate1 = TAX_RATES[poIndex % TAX_RATES.length];
    const sub1 = q1 * u1;
    const tax1 = sub1 * (taxRate1 / 100);
    const tot1 = sub1 + tax1;

    const q2 = ((poIndex % 5) + 2);
    const u2 = 800 + (poIndex * 30) % 3000;
    const taxRate2 = TAX_RATES[(poIndex + 1) % TAX_RATES.length];
    const sub2 = q2 * u2;
    const tax2 = sub2 * (taxRate2 / 100);
    const tot2 = sub2 + tax2;

    const subtotal = sub1 + sub2;
    const taxAmount = tax1 + tax2;
    const totalAmount = subtotal + taxAmount;

    await pool.query(
      `INSERT INTO purchase_orders (id, order_number, vendor_id, order_date, expected_date, reference, notes, status, subtotal, tax_amount, total_amount, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, orderNumber, vendorId, orderDate, expectedDate, `POREF-${poIndex}`, `Standard procurement order #${poIndex}`, status, subtotal.toFixed(2), taxAmount.toFixed(2), totalAmount.toFixed(2), adminId]
    );

    await pool.query(
      `INSERT INTO purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)`,
      [randomUUID(), id, p1, 'Primary furniture unit', q1, u1.toFixed(2), taxRate1, tax1.toFixed(2), sub1.toFixed(2), tot1.toFixed(2)]
    );

    await pool.query(
      `INSERT INTO purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 2)`,
      [randomUUID(), id, p2, 'Secondary hardware / accessory item', q2, u2.toFixed(2), taxRate2, tax2.toFixed(2), sub2.toFixed(2), tot2.toFixed(2)]
    );

    purchaseOrdersCount++;
    poIndex++;
  }
  console.log(`Purchase orders ready: ${purchaseOrdersCount}`);

  // 11. Vendor Bills & Items (300)
  console.log('Seeding 300 Vendor Bills...');
  const vbCount = await pool.query('SELECT COUNT(*)::int AS count FROM vendor_bills');
  let vendorBillsCount = vbCount.rows[0].count;
  let vbIndex = vendorBillsCount + 1;

  while (vendorBillsCount < 300) {
    const id = randomUUID();
    const billNumber = `VB-SEED-${String(vbIndex).padStart(6, '0')}`;
    const vendorId = vendors[(vbIndex - 1) % vendors.length];
    const month = ((vbIndex - 1) % 8) + 1;
    const day = ((vbIndex * 3) % 25) + 1;
    const invoiceDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dueDay = Math.min(day + 15, 28);
    const dueDate = `2026-${String(month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    const status = vbIndex % 3 === 0 ? 'DRAFT' : 'POSTED';
    const paymentStatus = status === 'DRAFT' ? 'UNPAID' : (vbIndex % 2 === 0 ? 'PAID' : 'UNPAID');

    const p1 = productIds[(vbIndex * 3 - 3) % productIds.length];
    const q1 = ((vbIndex % 8) + 1);
    const u1 = 1500 + (vbIndex * 25) % 4000;
    const taxRate1 = 18;
    const sub1 = q1 * u1;
    const tax1 = sub1 * 0.18;
    const tot1 = sub1 + tax1;

    await pool.query(
      `INSERT INTO vendor_bills (id, bill_number, vendor_id, vendor_invoice_number, invoice_date, due_date, reference, notes, subtotal, tax_amount, total_amount, payment_status, status, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, billNumber, vendorId, `INV-VEND-${vbIndex}`, invoiceDate, dueDate, `REF-VB-${vbIndex}`, `Vendor supplier invoice #${vbIndex}`, sub1.toFixed(2), tax1.toFixed(2), tot1.toFixed(2), paymentStatus, status, adminId]
    );

    await pool.query(
      `INSERT INTO vendor_bill_items (id, vendor_bill_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)`,
      [randomUUID(), id, p1, 'Procured material item', q1, u1.toFixed(2), taxRate1, tax1.toFixed(2), sub1.toFixed(2), tot1.toFixed(2)]
    );

    vendorBillsCount++;
    vbIndex++;
  }
  console.log(`Vendor bills ready: ${vendorBillsCount}`);

  // 12. Sales Orders & Items (300)
  console.log('Seeding 300 Sales Orders...');
  const soCount = await pool.query('SELECT COUNT(*)::int AS count FROM sales_orders');
  let salesOrdersCount = soCount.rows[0].count;
  let soIndex = salesOrdersCount + 1;

  while (salesOrdersCount < 300) {
    const id = randomUUID();
    const orderNumber = `SO-SEED-${String(soIndex).padStart(6, '0')}`;
    const customerId = customers[(soIndex - 1) % customers.length];
    const month = ((soIndex - 1) % 8) + 1;
    const day = ((soIndex * 2) % 27) + 1;
    const orderDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status = soIndex % 3 === 0 ? 'DRAFT' : 'CONFIRMED';

    const p1 = productIds[(soIndex * 2) % productIds.length];
    const q1 = ((soIndex % 6) + 1);
    const u1 = 2500 + (soIndex * 60) % 8000;
    const taxRate1 = 18;
    const sub1 = q1 * u1;
    const tax1 = sub1 * 0.18;
    const tot1 = sub1 + tax1;

    await pool.query(
      `INSERT INTO sales_orders (id, order_number, customer_id, order_date, reference, notes, status, subtotal, tax_amount, total_amount, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, orderNumber, customerId, orderDate, `SOREF-${soIndex}`, `Commercial client sale order #${soIndex}`, status, sub1.toFixed(2), tax1.toFixed(2), tot1.toFixed(2), adminId]
    );

    await pool.query(
      `INSERT INTO sales_order_items (id, sales_order_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)`,
      [randomUUID(), id, p1, 'Finished executive furniture piece', q1, u1.toFixed(2), taxRate1, tax1.toFixed(2), sub1.toFixed(2), tot1.toFixed(2)]
    );

    salesOrdersCount++;
    soIndex++;
  }
  console.log(`Sales orders ready: ${salesOrdersCount}`);

  // 13. Customer Invoices & Items (300)
  console.log('Seeding 300 Customer Invoices...');
  const ciCount = await pool.query('SELECT COUNT(*)::int AS count FROM customer_invoices');
  let customerInvoicesCount = ciCount.rows[0].count;
  let ciIndex = customerInvoicesCount + 1;

  while (customerInvoicesCount < 300) {
    const id = randomUUID();
    const invoiceNumber = `INV-SEED-${String(ciIndex).padStart(6, '0')}`;
    const customerId = customers[(ciIndex - 1) % customers.length];
    const month = ((ciIndex - 1) % 8) + 1;
    const day = ((ciIndex * 3) % 25) + 1;
    const invoiceDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dueDay = Math.min(day + 30, 28);
    const dueDate = `2026-${String(month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    const status = ciIndex % 4 === 0 ? 'DRAFT' : 'POSTED';
    const paymentStatus = status === 'DRAFT' ? 'UNPAID' : (ciIndex % 2 === 0 ? 'PAID' : 'PARTIALLY_PAID');

    const p1 = productIds[(ciIndex * 4 - 3) % productIds.length];
    const q1 = ((ciIndex % 4) + 1);
    const u1 = 3200 + (ciIndex * 50) % 9000;
    const taxRate1 = 18;
    const sub1 = q1 * u1;
    const tax1 = sub1 * 0.18;
    const tot1 = sub1 + tax1;

    await pool.query(
      `INSERT INTO customer_invoices (id, invoice_number, customer_id, invoice_date, due_date, reference, notes, subtotal, tax_amount, total_amount, status, payment_status, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, invoiceNumber, customerId, invoiceDate, dueDate, `REFCUST-${ciIndex}`, `Commercial receivable invoice #${ciIndex}`, sub1.toFixed(2), tax1.toFixed(2), tot1.toFixed(2), status, paymentStatus, adminId]
    );

    await pool.query(
      `INSERT INTO customer_invoice_items (id, customer_invoice_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)`,
      [randomUUID(), id, p1, 'Commercial furnishing and installation', q1, u1.toFixed(2), taxRate1, tax1.toFixed(2), sub1.toFixed(2), tot1.toFixed(2)]
    );

    customerInvoicesCount++;
    ciIndex++;
  }
  console.log(`Customer invoices ready: ${customerInvoicesCount}`);

  console.log('--- All 300 Seed Data Records Generated Successfully! ---');
}

seed300()
  .catch((err) => {
    console.error('Seed 300 failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
