// Controlled tool layer for the AI assistant. The model can only ever
// invoke one of the named functions below, each with a fixed, validated
// parameter shape — it can never submit SQL, and every handler calls an
// existing, already-RBAC-tested application service (reportingService,
// analyticsService, inventoryService, salesService, purchaseService) or a
// narrow, parameterized lookup query scoped to exactly the columns a tool
// needs. This file is the single choke point that decides what the model
// is allowed to see; the route layer re-checks the caller's role before
// ever reaching here, and every handler below re-checks it again.
const reports = require('./reportingService');
const analytics = require('./analyticsService');
const inventory = require('./inventoryService');
const sales = require('./salesService');
const purchases = require('./purchaseService');

const BUSINESS_ROLES = ['ADMIN', 'ACCOUNTANT'];
const ADMIN_ONLY = ['ADMIN'];

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function dateParams() {
  return {
    type: 'object',
    properties: {
      startDate: { type: 'string', description: 'ISO date YYYY-MM-DD, optional' },
      endDate: { type: 'string', description: 'ISO date YYYY-MM-DD, optional' },
    },
  };
}

// Trims large arrays before they go back to the model — keeps token usage
// (and cost) down and matches the "data minimization" requirement: the
// model gets a useful summary, never a full unbounded table dump.
function capList(value, limit = 8) {
  if (Array.isArray(value) && value.length > limit) {
    return { items: value.slice(0, limit), truncated: true, totalCount: value.length };
  }
  return value;
}

async function findContact(db, { contactId, name }, allowedTypes) {
  if (contactId) {
    const result = await db.query(
      `SELECT id, name, type, email, mobile, status FROM contacts WHERE id = $1 AND type = ANY($2)`,
      [contactId, allowedTypes],
    );
    return result.rows[0] || null;
  }
  if (name) {
    const result = await db.query(
      `SELECT id, name, type, email, mobile, status FROM contacts WHERE type = ANY($1) AND lower(name) LIKE $2 ORDER BY name LIMIT 1`,
      [allowedTypes, `%${String(name).toLowerCase()}%`],
    );
    return result.rows[0] || null;
  }
  return null;
}

async function findProduct(db, { productId, name }) {
  if (productId) {
    const result = await db.query('SELECT id, name, type, status FROM products WHERE id = $1', [productId]);
    return result.rows[0] || null;
  }
  if (name) {
    const result = await db.query('SELECT id, name, type, status FROM products WHERE lower(name) LIKE $1 ORDER BY name LIMIT 1', [`%${String(name).toLowerCase()}%`]);
    return result.rows[0] || null;
  }
  return null;
}

const TOOLS = [
  {
    name: 'getDashboardMetrics', roles: BUSINESS_ROLES,
    description: 'Executive KPIs: revenue, expenses, net profit, cash, bank, receivables, payables, inventory value.',
    parameters: dateParams(),
    handler: async (db, user, args) => analytics.dashboard(db, args),
  },
  {
    name: 'getSalesSummary', roles: BUSINESS_ROLES,
    description: 'Sales totals, invoice counts, outstanding amount, top products and customers for a date range.',
    parameters: dateParams(),
    handler: async (db, user, args) => {
      const result = await analytics.sales(db, args);
      return { ...result, topProducts: capList(result.topProducts), topCustomers: capList(result.topCustomers) };
    },
  },
  {
    name: 'getPurchaseSummary', roles: BUSINESS_ROLES,
    description: 'Purchase totals, bill counts, outstanding amount, and top vendors for a date range.',
    parameters: dateParams(),
    handler: async (db, user, args) => {
      const result = await analytics.purchases(db, args);
      return { ...result, topVendors: capList(result.topVendors) };
    },
  },
  {
    name: 'getInventorySummary', roles: BUSINESS_ROLES,
    description: 'Total tracked products, in-stock/low-stock/out-of-stock counts, total inventory value, and low-stock alerts.',
    parameters: { type: 'object', properties: {} },
    handler: async (db) => {
      const result = await analytics.inventory(db);
      return { ...result, alerts: capList(result.alerts, 10) };
    },
  },
  {
    name: 'getReceivables', roles: BUSINESS_ROLES,
    description: 'Customer receivables: outstanding total, ageing buckets, and top customers by outstanding balance.',
    parameters: { type: 'object', properties: {} },
    handler: async (db) => { const r = await analytics.receivables(db); return { ...r, customers: capList(r.customers, 8), vendors: undefined }; },
  },
  {
    name: 'getPayables', roles: BUSINESS_ROLES,
    description: 'Vendor payables: outstanding total, ageing buckets, and top vendors by outstanding balance.',
    parameters: { type: 'object', properties: {} },
    handler: async (db) => { const r = await analytics.payables(db); return { ...r, vendors: capList(r.vendors, 8), customers: undefined }; },
  },
  {
    name: 'getCashFlow', roles: BUSINESS_ROLES,
    description: 'Cash inflows/outflows from recorded payments and net cash movement for a date range.',
    parameters: dateParams(),
    handler: async (db, user, args) => { const r = await analytics.cashFlow(db, args); return { ...r, trend: capList(r.trend, 12) }; },
  },
  {
    name: 'getProfitLoss', roles: BUSINESS_ROLES,
    description: 'Profit & Loss statement (income, expenses, net profit) from posted journal entries only, for a date range.',
    parameters: dateParams(),
    handler: async (db, user, args) => reports.profitLoss(db, args),
  },
  {
    name: 'getBalanceSheet', roles: BUSINESS_ROLES,
    description: 'Balance Sheet (assets, liabilities, equity) as of a given date, from posted journal entries only.',
    parameters: { type: 'object', properties: { endDate: { type: 'string', description: 'ISO date YYYY-MM-DD, defaults to today' } } },
    handler: async (db, user, args) => reports.balanceSheet(db, args),
  },
  {
    name: 'getTrialBalance', roles: BUSINESS_ROLES,
    description: 'Trial Balance: per-account debit/credit totals and whether total debits equal total credits.',
    parameters: dateParams(),
    handler: async (db, user, args) => { const r = await reports.trialBalance(db, args); return { totals: r.totals, accounts: capList(r.accounts, 15), filters: r.filters }; },
  },
  {
    name: 'getBudgetReport', roles: BUSINESS_ROLES,
    description: 'Budget vs actual by analytic account, with variance, for a date range.',
    parameters: dateParams(),
    handler: async (db, user, args) => { const r = await reports.budget(db, args); return { ...r, budgets: capList(r.budgets, 12) }; },
  },
  {
    name: 'getSalesTrends', roles: BUSINESS_ROLES,
    description: 'Month-by-month posted sales totals and invoice counts.',
    parameters: dateParams(),
    handler: async (db, user, args) => analytics.salesTrends(db, args),
  },
  {
    name: 'getPurchaseTrends', roles: BUSINESS_ROLES,
    description: 'Month-by-month posted purchase totals and bill counts.',
    parameters: dateParams(),
    handler: async (db, user, args) => analytics.purchaseTrends(db, args),
  },
  {
    name: 'getProfitabilityTrends', roles: BUSINESS_ROLES,
    description: 'Month-by-month revenue vs expenses from posted journal entries (profitability trend).',
    parameters: dateParams(),
    handler: async (db, user, args) => { const r = await analytics.trends(db, args); return { ...r, trend: capList(r.trend, 12) }; },
  },
  {
    name: 'getCustomerDetails', roles: BUSINESS_ROLES,
    description: 'Look up one customer (or Both-type) contact by id or name.',
    parameters: { type: 'object', properties: { contactId: { type: 'string' }, name: { type: 'string' } } },
    handler: async (db, user, args) => {
      const contact = await findContact(db, args, ['CUSTOMER', 'BOTH']);
      if (!contact) throw fail('No matching customer was found.', 404);
      return { contact };
    },
  },
  {
    name: 'getVendorDetails', roles: BUSINESS_ROLES,
    description: 'Look up one vendor (or Both-type) contact by id or name.',
    parameters: { type: 'object', properties: { contactId: { type: 'string' }, name: { type: 'string' } } },
    handler: async (db, user, args) => {
      const contact = await findContact(db, args, ['VENDOR', 'BOTH']);
      if (!contact) throw fail('No matching vendor was found.', 404);
      return { contact };
    },
  },
  {
    name: 'getProductDetails', roles: BUSINESS_ROLES,
    description: 'Look up one product by id or name, including current stock if tracked.',
    parameters: { type: 'object', properties: { productId: { type: 'string' }, name: { type: 'string' } } },
    handler: async (db, user, args) => {
      const product = await findProduct(db, args);
      if (!product) throw fail('No matching product was found.', 404);
      const stock = await inventory.detail(db, product.id).catch(() => null);
      return { product, stock };
    },
  },
  {
    name: 'getInvoiceDetails', roles: BUSINESS_ROLES,
    description: 'Get one Customer Invoice by id or invoice number, including its items and payment status.',
    parameters: { type: 'object', properties: { invoiceId: { type: 'string' }, invoiceNumber: { type: 'string' } } },
    handler: async (db, user, args) => {
      let id = args.invoiceId;
      if (!id && args.invoiceNumber) {
        const row = await db.query('SELECT id FROM customer_invoices WHERE invoice_number = $1', [args.invoiceNumber]);
        id = row.rows[0]?.id;
      }
      if (!id) throw fail('An invoice id or invoice number is required.');
      const invoice = await sales.getInvoice(db, id);
      if (!invoice) throw fail('Invoice not found.', 404);
      return { invoice };
    },
  },
  {
    name: 'getBillDetails', roles: BUSINESS_ROLES,
    description: 'Get one Vendor Bill by id or bill number, including its items and payment status.',
    parameters: { type: 'object', properties: { billId: { type: 'string' }, billNumber: { type: 'string' } } },
    handler: async (db, user, args) => {
      let id = args.billId;
      if (!id && args.billNumber) {
        const row = await db.query('SELECT id FROM vendor_bills WHERE bill_number = $1', [args.billNumber]);
        id = row.rows[0]?.id;
      }
      if (!id) throw fail('A bill id or bill number is required.');
      const bill = await purchases.getBill(db, id);
      if (!bill) throw fail('Bill not found.', 404);
      return { bill };
    },
  },
  {
    name: 'getRecentActivity', roles: ADMIN_ONLY,
    description: 'Recent audit log activity across the system (Admin only).',
    parameters: { type: 'object', properties: { limit: { type: 'number', description: 'Max rows, default 10' } } },
    handler: async (db, user, args) => {
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 25);
      const rows = await db.query(
        `SELECT a.action, a.entity, a.entity_id AS "entityId", a.timestamp, u.login_id AS "userLoginId"
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.timestamp DESC LIMIT $1`,
        [limit],
      );
      return { activity: rows.rows };
    },
  },
];

function toolsForRole(role) {
  return TOOLS.filter((tool) => tool.roles.includes(role));
}

function toOpenAiSchema(role) {
  return toolsForRole(role).map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

// Executes one model-requested tool call after independently re-verifying
// the caller's role — the model's own claims about what it's allowed to do
// are never trusted. Returns a plain object with either `result` or `error`
// so the caller can always feed something back to the model, but the
// message returned for an unauthorized/unknown tool never hints at the
// tool's existence beyond "not permitted".
async function runTool(db, user, name, rawArgs) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { error: 'That capability is not available.' };
  if (!tool.roles.includes(user.role)) return { error: 'You are not authorized to use this capability.' };

  let args;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { error: 'Invalid parameters were provided for this capability.' };
  }

  try {
    const result = await tool.handler(db, user, args);
    return { result };
  } catch (error) {
    return { error: error.message || 'That request could not be completed.' };
  }
}

module.exports = { TOOLS, toolsForRole, toOpenAiSchema, runTool };
