const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Users
  const adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe@12345', 10);
  const accountantPasswordHash = await bcrypt.hash('Accountant@12345', 10);

  const admin = await prisma.user.upsert({
    where: { loginId: process.env.ADMIN_LOGIN_ID || 'admin' },
    update: {},
    create: {
      loginId: process.env.ADMIN_LOGIN_ID || 'admin',
      email: process.env.ADMIN_EMAIL || 'admin@urbanfurniture.local',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      isActive: true,
      approvalStatus: 'APPROVED',
      approvedAt: new Date(),
    },
  });

  const accountant = await prisma.user.upsert({
    where: { loginId: 'accountant' },
    update: {},
    create: {
      loginId: 'accountant',
      email: 'accountant@urbanfurniture.local',
      passwordHash: accountantPasswordHash,
      role: 'ACCOUNTANT',
      isActive: true,
      approvalStatus: 'APPROVED',
      approvedAt: new Date(),
    },
  });

  console.log(`✓ Users created: ${admin.loginId}, ${accountant.loginId}`);

  // 2. Chart of Accounts
  const accountDefinitions = [
    { code: '101000', name: 'Cash in Hand', type: 'ASSET', description: 'Liquid cash in company vault' },
    { code: '102000', name: 'Primary Bank Account', type: 'ASSET', description: 'Main operating checking account' },
    { code: '103000', name: 'Accounts Receivable', type: 'ASSET', description: 'Uncollected customer invoices' },
    { code: '104000', name: 'Furniture Inventory', type: 'ASSET', description: 'Finished goods and storable inventory' },
    { code: '201000', name: 'Accounts Payable', type: 'LIABILITY', description: 'Outstanding vendor obligations' },
    { code: '301000', name: 'Share Capital', type: 'EQUITY', description: 'Owners initial equity and capital' },
    { code: '401000', name: 'Product Sales Revenue', type: 'REVENUE', description: 'Income from furniture sales' },
    { code: '402000', name: 'Service Revenue', type: 'REVENUE', description: 'Income from installation & custom work' },
    { code: '501000', name: 'Cost of Goods Sold', type: 'EXPENSE', description: 'Direct materials and manufacturing cost' },
    { code: '601000', name: 'Showroom Rent Expense', type: 'EXPENSE', description: 'Monthly lease for retail showrooms' },
    { code: '602000', name: 'Utilities & Power', type: 'EXPENSE', description: 'Electricity, water, and internet' },
    { code: '603000', name: 'Staff Salaries & Wages', type: 'EXPENSE', description: 'Payroll for staff and warehouse workers' },
  ];

  const accountsMap = {};
  for (const acc of accountDefinitions) {
    const created = await prisma.account.upsert({
      where: { code: acc.code },
      update: { name: acc.name, type: acc.type, description: acc.description },
      create: acc,
    });
    accountsMap[acc.code] = created;
  }
  console.log(`✓ ${accountDefinitions.length} accounts in Chart of Accounts seeded`);

  // 3. Journals
  const journalDefinitions = [
    {
      code: 'INV',
      name: 'Customer Invoices',
      type: 'SALE',
      defaultDebitAccountId: accountsMap['103000'].id,
      defaultCreditAccountId: accountsMap['401000'].id,
    },
    {
      code: 'BILL',
      name: 'Vendor Bills',
      type: 'PURCHASE',
      defaultDebitAccountId: accountsMap['501000'].id,
      defaultCreditAccountId: accountsMap['201000'].id,
    },
    {
      code: 'BNK',
      name: 'Bank Operations',
      type: 'BANK',
      defaultDebitAccountId: accountsMap['102000'].id,
      defaultCreditAccountId: accountsMap['102000'].id,
    },
    {
      code: 'CSH',
      name: 'Cash Register',
      type: 'CASH',
      defaultDebitAccountId: accountsMap['101000'].id,
      defaultCreditAccountId: accountsMap['101000'].id,
    },
    {
      code: 'MISC',
      name: 'Miscellaneous Operations',
      type: 'GENERAL',
      defaultDebitAccountId: null,
      defaultCreditAccountId: null,
    },
  ];

  for (const j of journalDefinitions) {
    await prisma.journal.upsert({
      where: { code: j.code },
      update: {
        name: j.name,
        type: j.type,
        defaultDebitAccountId: j.defaultDebitAccountId,
        defaultCreditAccountId: j.defaultCreditAccountId,
      },
      create: j,
    });
  }
  console.log(`✓ ${journalDefinitions.length} Journals seeded`);

  // 4. Contacts
  const contactDefinitions = [
    {
      name: 'TeakWood Timber Works',
      type: 'VENDOR',
      email: 'vendor@teakwood.example.com',
      phone: '+91 98765 43210',
      taxId: '27AABCT1332M1ZV',
      street: '45 Industrial Area, Phase 2',
      city: 'Pune',
      state: 'Maharashtra',
      zip: '411018',
      country: 'India',
      isCompany: true,
    },
    {
      name: 'SteelCraft Precision Hardware',
      type: 'VENDOR',
      email: 'sales@steelcraft.example.com',
      phone: '+91 98220 11223',
      taxId: '27AAACS9876P1ZR',
      street: '12 Metal Yard, MIDC',
      city: 'Nagpur',
      state: 'Maharashtra',
      zip: '440028',
      country: 'India',
      isCompany: true,
    },
    {
      name: 'Metro Workspaces Ltd',
      type: 'CUSTOMER',
      email: 'procurement@metroworkspaces.com',
      phone: '+91 99300 88776',
      taxId: '27AAACM4455Q1ZT',
      street: 'Plot 108, Bandra Kurla Complex',
      city: 'Mumbai',
      state: 'Maharashtra',
      zip: '400051',
      country: 'India',
      isCompany: true,
    },
    {
      name: 'DesignStudio Architects',
      type: 'CUSTOMER',
      email: 'contact@designstudio.architects',
      phone: '+91 91234 56789',
      taxId: '27AAACD9988E1ZS',
      street: '88 MG Road, Fort',
      city: 'Mumbai',
      state: 'Maharashtra',
      zip: '400001',
      country: 'India',
      isCompany: true,
    },
  ];

  for (const c of contactDefinitions) {
    const existing = await prisma.contact.findFirst({ where: { email: c.email } });
    if (!existing) {
      await prisma.contact.create({ data: c });
    }
  }
  console.log(`✓ ${contactDefinitions.length} Contacts seeded`);

  // 5. Products
  const productDefinitions = [
    {
      code: 'FURN-CHAIR-001',
      name: 'Ergonomic Mesh Task Chair',
      description: 'Adjustable lumbar support with breathable mesh back and multi-lock recline',
      salesPrice: 14500.00,
      costPrice: 8500.00,
      type: 'STORABLE',
      uom: 'Units',
      salesAccountId: accountsMap['401000'].id,
      expenseAccountId: accountsMap['501000'].id,
    },
    {
      code: 'FURN-DESK-001',
      name: 'Executive Teak Office Desk (6ft)',
      description: 'Solid teakwood executive desk with wire grommet and concealed drawer unit',
      salesPrice: 32000.00,
      costPrice: 19500.00,
      type: 'STORABLE',
      uom: 'Units',
      salesAccountId: accountsMap['401000'].id,
      expenseAccountId: accountsMap['501000'].id,
    },
    {
      code: 'FURN-CONF-001',
      name: '10-Seater Boardroom Conference Table',
      description: 'Premium walnut veneered conference table with integrated power sockets',
      salesPrice: 65000.00,
      costPrice: 38000.00,
      type: 'STORABLE',
      uom: 'Units',
      salesAccountId: accountsMap['401000'].id,
      expenseAccountId: accountsMap['501000'].id,
    },
    {
      code: 'SERV-INST-001',
      name: 'White-Glove Furniture Installation',
      description: 'On-site unpacking, assembly, room positioning, and packaging removal',
      salesPrice: 2500.00,
      costPrice: 1000.00,
      type: 'SERVICE',
      uom: 'Hours',
      salesAccountId: accountsMap['402000'].id,
      expenseAccountId: accountsMap['603000'].id,
    },
  ];

  for (const p of productDefinitions) {
    await prisma.product.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
  }
  console.log(`✓ ${productDefinitions.length} Products seeded`);

  // 6. Analytic Accounts
  const analyticDefinitions = [
    { code: 'AN-MUMBAI', name: 'Downtown Mumbai Showroom', description: 'Retail and direct consumer operations' },
    { code: 'AN-CORP', name: 'Corporate & B2B Fitout Projects', description: 'Enterprise bulk orders and commercial contracts' },
    { code: 'AN-DELHI', name: 'North India Distribution Hub', description: 'Northern region logistics and warehousing' },
  ];

  const analyticMap = {};
  for (const a of analyticDefinitions) {
    const created = await prisma.analyticAccount.upsert({
      where: { code: a.code },
      update: a,
      create: a,
    });
    analyticMap[a.code] = created;
  }
  console.log(`✓ ${analyticDefinitions.length} Analytic Accounts seeded`);

  // 7. Budget
  const existingBudget = await prisma.budget.findFirst({
    where: { name: 'Q1 FY2026 Commercial & Retail Budget' },
  });

  if (!existingBudget) {
    await prisma.budget.create({
      data: {
        name: 'Q1 FY2026 Commercial & Retail Budget',
        dateFrom: new Date('2026-04-01T00:00:00.000Z'),
        dateTo: new Date('2026-06-30T23:59:59.000Z'),
        description: 'First quarter operational and sales budget for Urban Furniture',
        items: {
          create: [
            {
              analyticAccountId: analyticMap['AN-MUMBAI'].id,
              accountId: accountsMap['601000'].id,
              plannedAmount: 180000.00,
              practicalAmount: 175000.00,
            },
            {
              analyticAccountId: analyticMap['AN-CORP'].id,
              accountId: accountsMap['401000'].id,
              plannedAmount: 1500000.00,
              practicalAmount: 1250000.00,
            },
          ],
        },
      },
    });
    console.log('✓ Initial Budget seeded');
  }

  console.log('🎉 Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
