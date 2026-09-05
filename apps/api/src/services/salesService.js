const { randomUUID } = require('crypto');
const { withTransaction } = require('../db/transaction');
const { logAudit } = require('../db/audit');
const accounting = require('./accountingService');
const inventory = require('./inventoryService');

const TAX_RATES = Object.freeze([0, 5, 12, 18, 28]);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const money = (value) => { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null; };

function calculate(lines) {
  if (!Array.isArray(lines) || !lines.length) throw fail('At least one item is required.');
  return lines.map((line, i) => {
    const quantity = Number(line.quantity);
    const unitPrice = money(line.unitPrice);
    const taxRate = Number(line.taxRate ?? 0);
    if (!line.productId) throw fail(`Item ${i + 1} product is required.`);
    if (!Number.isFinite(quantity) || quantity <= 0) throw fail(`Item ${i + 1} quantity must be greater than zero.`);
    if (unitPrice === null) throw fail(`Item ${i + 1} unit price must be non-negative.`);
    if (!TAX_RATES.includes(taxRate)) throw fail(`Item ${i + 1} tax rate is invalid.`);
    const lineSubtotal = quantity * unitPrice;
    const taxAmount = lineSubtotal * taxRate / 100;
    return { ...line, quantity, unitPrice, taxRate, lineSubtotal, taxAmount, lineTotal: lineSubtotal + taxAmount };
  });
}

function totals(lines) {
  return lines.reduce((r, l) => ({
    subtotal: r.subtotal + l.lineSubtotal,
    taxAmount: r.taxAmount + l.taxAmount,
    totalAmount: r.totalAmount + l.lineTotal,
  }), { subtotal: 0, taxAmount: 0, totalAmount: 0 });
}

async function assertCustomerAndProducts(db, customerId, lines) {
  const customer = await db.query("SELECT id FROM contacts WHERE id = $1 AND status = 'ACTIVE' AND type IN ('CUSTOMER', 'BOTH')", [customerId]);
  if (!customer.rowCount) throw fail('Customer must be an active Customer or Both contact.');
  for (const line of lines) {
    const product = await db.query("SELECT id FROM products WHERE id = $1 AND status = 'ACTIVE'", [line.productId]);
    if (!product.rowCount) throw fail('Product is archived and cannot be used for a new Sales transaction.');
  }
}

async function insertItems(tx, table, parentColumn, parentId, lines) {
  for (const [i, l] of lines.entries()) {
    await tx.query(
      `INSERT INTO ${table} (id, ${parentColumn}, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_subtotal, line_total, line_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [randomUUID(), parentId, l.productId, l.description?.trim() || null, l.quantity, l.unitPrice, l.taxRate, l.taxAmount, l.lineSubtotal, l.lineTotal, i + 1],
    );
  }
}

// -------------------------------------------------------------------------
// Sales Orders
// -------------------------------------------------------------------------

const orderSelect = `
  o.id, o.order_number AS "orderNumber",
  o.customer_id AS "customerId", o.order_date AS "orderDate", o.expected_date AS "expectedDate",
  o.reference, o.notes, o.status,
  o.subtotal::text AS subtotal, o.tax_amount::text AS "taxAmount", o.total_amount::text AS "totalAmount",
  o.created_by_id AS "createdById", o.confirmed_by_id AS "confirmedById", o.confirmed_at AS "confirmedAt",
  o.cancelled_by_id AS "cancelledById", o.cancelled_at AS "cancelledAt",
  o.created_at AS "createdAt", o.updated_at AS "updatedAt",
  c.name AS "customerName", u.login_id AS "createdBy", cu.login_id AS "confirmedBy"
`;

async function getOrder(db, id) {
  const header = await db.query(
    `SELECT ${orderSelect}
     FROM sales_orders o
     JOIN contacts c ON c.id = o.customer_id
     JOIN users u ON u.id = o.created_by_id
     LEFT JOIN users cu ON cu.id = o.confirmed_by_id
     WHERE o.id = $1`,
    [id],
  );
  if (!header.rowCount) return null;
  const items = await db.query(
    `SELECT i.id, i.product_id AS "productId", i.description, i.quantity,
            i.unit_price::text AS "unitPrice", i.tax_rate::text AS "taxRate", i.tax_amount::text AS "taxAmount",
            i.line_subtotal::text AS "lineSubtotal", i.line_total::text AS "lineTotal", i.line_order AS "lineOrder",
            p.name AS "productName"
     FROM sales_order_items i
     JOIN products p ON p.id = i.product_id
     WHERE i.sales_order_id = $1
     ORDER BY i.line_order`,
    [id],
  );
  return { ...header.rows[0], items: items.rows };
}

async function createOrder(db, userId, body) {
  const lines = calculate(body.items || body.lines);
  if (!body.customerId || !body.orderDate) throw fail('Customer and order date are required.');
  if (body.expectedDate && body.expectedDate < body.orderDate) throw fail('Expected date cannot be before order date.');
  const t = totals(lines);
  return withTransaction(db, async (tx) => {
    await assertCustomerAndProducts(tx, body.customerId, lines);
    const n = await tx.query("SELECT nextval('sales_order_number_seq') n");
    const id = randomUUID();
    const orderNumber = `SO-${String(n.rows[0].n).padStart(6, '0')}`;
    await tx.query(
      `INSERT INTO sales_orders (id, order_number, customer_id, order_date, expected_date, reference, notes, subtotal, tax_amount, total_amount, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, orderNumber, body.customerId, body.orderDate, body.expectedDate || null, body.reference?.trim() || null, body.notes?.trim() || null, t.subtotal, t.taxAmount, t.totalAmount, userId],
    );
    await insertItems(tx, 'sales_order_items', 'sales_order_id', id, lines);
    await logAudit(tx, { userId, action: 'SALES_ORDER_CREATED', entity: 'SalesOrder', entityId: id, metadata: { orderNumber } });
    return getOrder(tx, id);
  });
}

async function updateOrder(db, id, userId, body) {
  const current = await getOrder(db, id);
  if (!current) throw fail('Sales Order not found.', 404);
  if (current.status !== 'DRAFT') throw fail('Only Draft Sales Orders can be edited.');
  const merged = {
    customerId: body.customerId || current.customerId,
    orderDate: body.orderDate || current.orderDate,
    expectedDate: body.expectedDate === undefined ? current.expectedDate : body.expectedDate,
    reference: body.reference === undefined ? current.reference : body.reference,
    notes: body.notes === undefined ? current.notes : body.notes,
    items: body.items || body.lines || current.items.map((i) => ({ productId: i.productId, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })),
  };
  if (merged.expectedDate && merged.expectedDate < merged.orderDate) throw fail('Expected date cannot be before order date.');
  const lines = calculate(merged.items);
  const t = totals(lines);
  return withTransaction(db, async (tx) => {
    await assertCustomerAndProducts(tx, merged.customerId, lines);
    await tx.query(
      `UPDATE sales_orders SET customer_id=$1, order_date=$2, expected_date=$3, reference=$4, notes=$5, subtotal=$6, tax_amount=$7, total_amount=$8, updated_at=NOW() WHERE id=$9`,
      [merged.customerId, merged.orderDate, merged.expectedDate || null, merged.reference?.trim() || null, merged.notes?.trim() || null, t.subtotal, t.taxAmount, t.totalAmount, id],
    );
    await tx.query('DELETE FROM sales_order_items WHERE sales_order_id = $1', [id]);
    await insertItems(tx, 'sales_order_items', 'sales_order_id', id, lines);
    await logAudit(tx, { userId, action: 'SALES_ORDER_UPDATED', entity: 'SalesOrder', entityId: id, metadata: { fields: Object.keys(body) } });
    return getOrder(tx, id);
  });
}

async function confirmOrder(db, id, userId) {
  return withTransaction(db, async (tx) => {
    const r = await tx.query(
      "UPDATE sales_orders SET status='CONFIRMED', confirmed_by_id=$1, confirmed_at=NOW(), updated_at=NOW() WHERE id=$2 AND status='DRAFT' RETURNING id",
      [userId, id],
    );
    if (!r.rowCount) throw fail('Only Draft Sales Orders can be confirmed.');
    await logAudit(tx, { userId, action: 'SALES_ORDER_CONFIRMED', entity: 'SalesOrder', entityId: id });
    return getOrder(tx, id);
  });
}

async function cancelOrder(db, id, userId) {
  return withTransaction(db, async (tx) => {
    const r = await tx.query(
      "UPDATE sales_orders SET status='CANCELLED', cancelled_by_id=$1, cancelled_at=NOW(), updated_at=NOW() WHERE id=$2 AND status='DRAFT' RETURNING id",
      [userId, id],
    );
    if (!r.rowCount) throw fail('Only Draft Sales Orders can be cancelled.');
    await logAudit(tx, { userId, action: 'SALES_ORDER_CANCELLED', entity: 'SalesOrder', entityId: id });
    return getOrder(tx, id);
  });
}

// -------------------------------------------------------------------------
// Customer Invoices
// -------------------------------------------------------------------------

const invoiceSelect = `
  i.id, i.invoice_number AS "invoiceNumber", i.customer_id AS "customerId", i.sales_order_id AS "salesOrderId",
  i.invoice_date AS "invoiceDate", i.due_date AS "dueDate", i.reference, i.notes, i.status,
  i.payment_status AS "paymentStatus",
  i.subtotal::text AS subtotal, i.tax_amount::text AS "taxAmount", i.total_amount::text AS "totalAmount",
  i.accounting_entry_id AS "accountingEntryId",
  i.created_by_id AS "createdById", i.posted_by_id AS "postedById", i.posted_at AS "postedAt",
  i.created_at AS "createdAt", i.updated_at AS "updatedAt",
  c.name AS "customerName", u.login_id AS "createdBy", pu.login_id AS "postedBy",
  so.order_number AS "salesOrderNumber"
`;

async function getInvoice(db, id) {
  const header = await db.query(
    `SELECT ${invoiceSelect}
     FROM customer_invoices i
     JOIN contacts c ON c.id = i.customer_id
     JOIN users u ON u.id = i.created_by_id
     LEFT JOIN users pu ON pu.id = i.posted_by_id
     LEFT JOIN sales_orders so ON so.id = i.sales_order_id
     WHERE i.id = $1`,
    [id],
  );
  if (!header.rowCount) return null;
  const items = await db.query(
    `SELECT i.id, i.product_id AS "productId", i.description, i.quantity,
            i.unit_price::text AS "unitPrice", i.tax_rate::text AS "taxRate", i.tax_amount::text AS "taxAmount",
            i.line_subtotal::text AS "lineSubtotal", i.line_total::text AS "lineTotal", i.line_order AS "lineOrder",
            p.name AS "productName"
     FROM customer_invoice_items i
     JOIN products p ON p.id = i.product_id
     WHERE i.customer_invoice_id = $1
     ORDER BY i.line_order`,
    [id],
  );
  return { ...header.rows[0], items: items.rows };
}

async function createInvoice(db, userId, body) {
  const lines = calculate(body.items || body.lines);
  if (!body.customerId || !body.invoiceDate || !body.dueDate) throw fail('Customer, invoice date, and due date are required.');
  if (body.dueDate < body.invoiceDate) throw fail('Due date cannot be before invoice date.');
  const t = totals(lines);
  return withTransaction(db, async (tx) => {
    await assertCustomerAndProducts(tx, body.customerId, lines);
    if (body.salesOrderId) {
      const order = await tx.query("SELECT id FROM sales_orders WHERE id = $1 AND customer_id = $2 AND status = 'CONFIRMED'", [body.salesOrderId, body.customerId]);
      if (!order.rowCount) throw fail('Sales Order must be confirmed and belong to this customer.');
    }
    const n = await tx.query("SELECT nextval('customer_invoice_number_seq') n");
    const id = randomUUID();
    const invoiceNumber = `INV-${String(n.rows[0].n).padStart(6, '0')}`;
    await tx.query(
      `INSERT INTO customer_invoices (id, invoice_number, customer_id, sales_order_id, invoice_date, due_date, reference, notes, subtotal, tax_amount, total_amount, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, invoiceNumber, body.customerId, body.salesOrderId || null, body.invoiceDate, body.dueDate, body.reference?.trim() || null, body.notes?.trim() || null, t.subtotal, t.taxAmount, t.totalAmount, userId],
    );
    await insertItems(tx, 'customer_invoice_items', 'customer_invoice_id', id, lines);
    await logAudit(tx, { userId, action: 'CUSTOMER_INVOICE_CREATED', entity: 'CustomerInvoice', entityId: id, metadata: { invoiceNumber } });
    return getInvoice(tx, id);
  });
}

async function updateInvoice(db, id, userId, body) {
  const current = await getInvoice(db, id);
  if (!current) throw fail('Customer Invoice not found.', 404);
  if (current.status !== 'DRAFT') throw fail('Only Draft Customer Invoices can be edited.');
  const merged = {
    customerId: body.customerId || current.customerId,
    salesOrderId: body.salesOrderId === undefined ? current.salesOrderId : body.salesOrderId,
    invoiceDate: body.invoiceDate || current.invoiceDate,
    dueDate: body.dueDate || current.dueDate,
    reference: body.reference === undefined ? current.reference : body.reference,
    notes: body.notes === undefined ? current.notes : body.notes,
    items: body.items || body.lines || current.items.map((i) => ({ productId: i.productId, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })),
  };
  if (merged.dueDate < merged.invoiceDate) throw fail('Due date cannot be before invoice date.');
  const lines = calculate(merged.items);
  const t = totals(lines);
  return withTransaction(db, async (tx) => {
    await assertCustomerAndProducts(tx, merged.customerId, lines);
    await tx.query(
      `UPDATE customer_invoices SET customer_id=$1, sales_order_id=$2, invoice_date=$3, due_date=$4, reference=$5, notes=$6, subtotal=$7, tax_amount=$8, total_amount=$9, updated_at=NOW() WHERE id=$10`,
      [merged.customerId, merged.salesOrderId || null, merged.invoiceDate, merged.dueDate, merged.reference?.trim() || null, merged.notes?.trim() || null, t.subtotal, t.taxAmount, t.totalAmount, id],
    );
    await tx.query('DELETE FROM customer_invoice_items WHERE customer_invoice_id = $1', [id]);
    await insertItems(tx, 'customer_invoice_items', 'customer_invoice_id', id, lines);
    await logAudit(tx, { userId, action: 'CUSTOMER_INVOICE_UPDATED', entity: 'CustomerInvoice', entityId: id, metadata: { fields: Object.keys(body) } });
    return getInvoice(tx, id);
  });
}

async function invoiceFromOrder(db, orderId) {
  const order = await getOrder(db, orderId);
  if (!order) throw fail('Sales Order not found.', 404);
  if (order.status !== 'CONFIRMED') throw fail('Only confirmed Sales Orders can create Customer Invoices.');
  const today = new Date().toISOString().slice(0, 10);
  return {
    customerId: order.customerId,
    salesOrderId: order.id,
    invoiceDate: today,
    dueDate: today,
    reference: order.reference,
    notes: order.notes,
    items: order.items.map((i) => ({ productId: i.productId, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })),
  };
}

async function postInvoice(db, id, userId) {
  const invoice = await getInvoice(db, id);
  if (!invoice) throw fail('Customer Invoice not found.', 404);
  if (invoice.status !== 'DRAFT') throw fail('Only Draft Customer Invoices can be posted.');

  const accountRows = await db.query("SELECT id, account_code FROM accounts WHERE status = 'ACTIVE' AND account_code IN ('1003', '4001', '2002')");
  const accountId = Object.fromEntries(accountRows.rows.map((a) => [a.account_code, a.id]));
  const journal = await db.query("SELECT id FROM journals WHERE type = 'SALES' AND status = 'ACTIVE' LIMIT 1");
  if (!accountId['1003'] || !accountId['4001'] || !journal.rowCount || (Number(invoice.taxAmount) > 0 && !accountId['2002'])) {
    throw fail('Sales Journal, Debtors, Sales Income, and Output Tax Payable must be configured.');
  }

  const entryLines = [
    { accountId: accountId['1003'], description: `Receivable for ${invoice.invoiceNumber}`, debit: invoice.totalAmount, credit: '0.00' },
    { accountId: accountId['4001'], description: `Sales income for ${invoice.invoiceNumber}`, debit: '0.00', credit: invoice.subtotal },
  ];
  if (Number(invoice.taxAmount) > 0) {
    entryLines.push({ accountId: accountId['2002'], description: `Output tax for ${invoice.invoiceNumber}`, debit: '0.00', credit: invoice.taxAmount });
  }

  const entry = await accounting.createDraftEntry(db, userId, {
    journalId: journal.rows[0].id,
    entryDate: invoice.invoiceDate,
    reference: invoice.invoiceNumber,
    description: `Customer Invoice ${invoice.invoiceNumber}`,
    lines: entryLines,
  });
  await accounting.postEntry(db, entry.id, userId);

  return withTransaction(db, async (tx) => {
    const r = await tx.query(
      "UPDATE customer_invoices SET status='POSTED', posted_by_id=$1, posted_at=NOW(), accounting_entry_id=$2, updated_at=NOW() WHERE id=$3 AND status='DRAFT' RETURNING id",
      [userId, entry.id, id],
    );
    if (!r.rowCount) throw fail('Customer Invoice could not be posted.');
    await inventory.fulfillCustomerInvoice(tx, invoice, userId);
    await logAudit(tx, { userId, action: 'CUSTOMER_INVOICE_POSTED', entity: 'CustomerInvoice', entityId: id, metadata: { accountingEntryId: entry.id } });
    return getInvoice(tx, id);
  });
}

async function cancelInvoice(db, id, userId) {
  return withTransaction(db, async (tx) => {
    const r = await tx.query(
      "UPDATE customer_invoices SET status='CANCELLED', updated_at=NOW() WHERE id=$1 AND status='DRAFT' RETURNING id",
      [id],
    );
    if (!r.rowCount) throw fail('Only Draft Customer Invoices can be cancelled.');
    await logAudit(tx, { userId, action: 'CUSTOMER_INVOICE_CANCELLED', entity: 'CustomerInvoice', entityId: id });
    return getInvoice(tx, id);
  });
}

module.exports = {
  TAX_RATES,
  calculate,
  totals,
  createOrder,
  getOrder,
  updateOrder,
  confirmOrder,
  cancelOrder,
  createInvoice,
  getInvoice,
  updateInvoice,
  invoiceFromOrder,
  postInvoice,
  cancelInvoice,
};
