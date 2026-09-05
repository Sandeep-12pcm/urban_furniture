const { randomUUID } = require('crypto');
const { withTransaction } = require('../db/transaction');
const { logAudit } = require('../db/audit');
const accounting = require('./accountingService');

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

const paymentSelect = `
  p.id, p.payment_number AS "paymentNumber", p.type, p.contact_id AS "contactId", c.name AS "contactName",
  p.customer_invoice_id AS "customerInvoiceId", ci.invoice_number AS "customerInvoiceNumber",
  p.vendor_bill_id AS "vendorBillId", vb.bill_number AS "vendorBillNumber",
  p.payment_date AS "paymentDate", p.amount::text AS amount, p.method, p.reference, p.notes, p.status,
  p.accounting_entry_id AS "accountingEntryId", p.reversal_entry_id AS "reversalEntryId",
  p.created_by_id AS "createdById", u.login_id AS "createdBy",
  p.cancelled_by_id AS "cancelledById", cu.login_id AS "cancelledBy", p.cancelled_at AS "cancelledAt",
  p.created_at AS "createdAt", p.updated_at AS "updatedAt"
`;
const paymentJoins = `
  JOIN contacts c ON c.id = p.contact_id
  JOIN users u ON u.id = p.created_by_id
  LEFT JOIN users cu ON cu.id = p.cancelled_by_id
  LEFT JOIN customer_invoices ci ON ci.id = p.customer_invoice_id
  LEFT JOIN vendor_bills vb ON vb.id = p.vendor_bill_id
`;

async function getPayment(db, id) {
  const result = await db.query(`SELECT ${paymentSelect} FROM payments p ${paymentJoins} WHERE p.id = $1`, [id]);
  return result.rows[0] || null;
}

async function activePaymentsTotal(db, column, id) {
  const result = await db.query(
    `SELECT COALESCE(SUM(amount), 0)::text AS total FROM payments WHERE ${column} = $1 AND status = 'POSTED'`,
    [id],
  );
  return Number(result.rows[0].total);
}

function nextPaymentStatus(totalAmount, amountPaid) {
  if (amountPaid <= 0) return 'UNPAID';
  if (amountPaid >= Number(totalAmount)) return 'PAID';
  return 'PARTIALLY_PAID';
}

// Returns the id of the active CASH/BANK journal to post the payment
// through (its default account is what "Cash/Bank" resolves to below).
async function cashOrBankAccount(db, method) {
  const journalType = method === 'BANK' ? 'BANK' : 'CASH';
  const journal = await db.query(
    `SELECT j.id, a.status AS "accountStatus" FROM journals j JOIN accounts a ON a.id = j.default_account_id
     WHERE j.type = $1 AND j.status = 'ACTIVE' LIMIT 1`,
    [journalType],
  );
  if (!journal.rowCount || journal.rows[0].accountStatus !== 'ACTIVE') {
    throw fail(`A ${journalType === 'BANK' ? 'Bank' : 'Cash'} Journal with an active default account must be configured before recording ${method.toLowerCase()} payments.`);
  }
  return journal.rows[0].id;
}

function validateAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw fail('Payment amount must be greater than zero.');
  return value;
}

// -------------------------------------------------------------------------
// Customer payments: Customer Invoice -> Cash/Bank -> reduces Debtors.
// Debit Cash/Bank, Credit Debtors (1003).
// -------------------------------------------------------------------------
async function recordCustomerPaymentLegacy(db, userId, invoiceId, body) {
  const amount = validateAmount(body.amount);
  if (!body.paymentDate) throw fail('Payment date is required.');
  if (!['CASH', 'BANK'].includes(body.method)) throw fail('Payment method must be Cash or Bank.');

  const invoice = await db.query(
    "SELECT id, customer_id, total_amount, payment_status, status FROM customer_invoices WHERE id = $1",
    [invoiceId],
  );
  if (!invoice.rowCount) throw fail('Customer Invoice not found.', 404);
  const inv = invoice.rows[0];
  if (inv.status !== 'POSTED') throw fail('Only a Posted Customer Invoice can receive a payment.');

  const alreadyPaid = await activePaymentsTotal(db, 'customer_invoice_id', invoiceId);
  const outstanding = Number(inv.total_amount) - alreadyPaid;
  if (outstanding <= 0) throw fail('This Customer Invoice is already fully paid.');
  if (amount > outstanding) throw fail(`Payment amount cannot exceed the outstanding balance of ${outstanding.toFixed(2)}.`);

  const paymentJournalId = await cashOrBankAccount(db, body.method);
  const accountRows = await db.query(
    `SELECT j.default_account_id AS "cashBankAccountId", (SELECT id FROM accounts WHERE account_code = '1003' AND status = 'ACTIVE') AS "debtorsAccountId"
     FROM journals j WHERE j.id = $1`,
    [paymentJournalId],
  );
  const { cashBankAccountId, debtorsAccountId } = accountRows.rows[0];
  if (!debtorsAccountId) throw fail('Debtors account (1003) must be configured before recording customer payments.');

  const entry = await accounting.createDraftEntry(db, userId, {
    journalId: paymentJournalId,
    entryDate: body.paymentDate,
    reference: `Payment for ${invoiceId}`,
    description: `Customer payment received`,
    lines: [
      { accountId: cashBankAccountId, debit: amount.toFixed(2), credit: '0.00' },
      { accountId: debtorsAccountId, debit: '0.00', credit: amount.toFixed(2) },
    ],
  });
  await accounting.postEntry(db, entry.id, userId);

  return withTransaction(db, async (tx) => {
    const n = await tx.query("SELECT nextval('payment_number_seq') n");
    const id = randomUUID();
    const paymentNumber = `PMT-${String(n.rows[0].n).padStart(6, '0')}`;
    await tx.query(
      `INSERT INTO payments (id, payment_number, type, contact_id, customer_invoice_id, payment_date, amount, method, reference, notes, accounting_entry_id, created_by_id)
       VALUES ($1, $2, 'CUSTOMER', $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, paymentNumber, inv.customer_id, invoiceId, body.paymentDate, amount.toFixed(2), body.method, body.reference?.trim() || null, body.notes?.trim() || null, entry.id, userId],
    );
    const newStatus = nextPaymentStatus(inv.total_amount, alreadyPaid + amount);
    await tx.query("UPDATE customer_invoices SET payment_status = $1, updated_at = NOW() WHERE id = $2", [newStatus, invoiceId]);
    await logAudit(tx, { userId, action: 'CUSTOMER_PAYMENT_RECORDED', entity: 'Payment', entityId: id, metadata: { paymentNumber, invoiceId, amount: amount.toFixed(2) } });
    return getPayment(tx, id);
  });
}

// -------------------------------------------------------------------------
// Vendor payments: Vendor Bill -> Cash/Bank -> reduces Creditors.
// Debit Creditors (2001), Credit Cash/Bank.
// -------------------------------------------------------------------------
async function recordVendorPaymentLegacy(db, userId, billId, body) {
  const amount = validateAmount(body.amount);
  if (!body.paymentDate) throw fail('Payment date is required.');
  if (!['CASH', 'BANK'].includes(body.method)) throw fail('Payment method must be Cash or Bank.');

  const bill = await db.query(
    "SELECT id, vendor_id, total_amount, payment_status, status FROM vendor_bills WHERE id = $1",
    [billId],
  );
  if (!bill.rowCount) throw fail('Vendor Bill not found.', 404);
  const vb = bill.rows[0];
  if (vb.status !== 'POSTED') throw fail('Only a Posted Vendor Bill can receive a payment.');

  const alreadyPaid = await activePaymentsTotal(db, 'vendor_bill_id', billId);
  const outstanding = Number(vb.total_amount) - alreadyPaid;
  if (outstanding <= 0) throw fail('This Vendor Bill is already fully paid.');
  if (amount > outstanding) throw fail(`Payment amount cannot exceed the outstanding balance of ${outstanding.toFixed(2)}.`);

  const paymentJournalId = await cashOrBankAccount(db, body.method);
  const accountRows = await db.query(
    `SELECT j.default_account_id AS "cashBankAccountId", (SELECT id FROM accounts WHERE account_code = '2001' AND status = 'ACTIVE') AS "creditorsAccountId"
     FROM journals j WHERE j.id = $1`,
    [paymentJournalId],
  );
  const { cashBankAccountId, creditorsAccountId } = accountRows.rows[0];
  if (!creditorsAccountId) throw fail('Creditors account (2001) must be configured before recording vendor payments.');

  const entry = await accounting.createDraftEntry(db, userId, {
    journalId: paymentJournalId,
    entryDate: body.paymentDate,
    reference: `Payment for ${billId}`,
    description: `Vendor payment made`,
    lines: [
      { accountId: creditorsAccountId, debit: amount.toFixed(2), credit: '0.00' },
      { accountId: cashBankAccountId, debit: '0.00', credit: amount.toFixed(2) },
    ],
  });
  await accounting.postEntry(db, entry.id, userId);

  return withTransaction(db, async (tx) => {
    const n = await tx.query("SELECT nextval('payment_number_seq') n");
    const id = randomUUID();
    const paymentNumber = `PMT-${String(n.rows[0].n).padStart(6, '0')}`;
    await tx.query(
      `INSERT INTO payments (id, payment_number, type, contact_id, vendor_bill_id, payment_date, amount, method, reference, notes, accounting_entry_id, created_by_id)
       VALUES ($1, $2, 'VENDOR', $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, paymentNumber, vb.vendor_id, billId, body.paymentDate, amount.toFixed(2), body.method, body.reference?.trim() || null, body.notes?.trim() || null, entry.id, userId],
    );
    const newStatus = nextPaymentStatus(vb.total_amount, alreadyPaid + amount);
    await tx.query("UPDATE vendor_bills SET payment_status = $1, updated_at = NOW() WHERE id = $2", [newStatus, billId]);
    await logAudit(tx, { userId, action: 'VENDOR_PAYMENT_RECORDED', entity: 'Payment', entityId: id, metadata: { paymentNumber, billId, amount: amount.toFixed(2) } });
    return getPayment(tx, id);
  });
}

// Payment, journal entry, allocation status, and audit record must share one
// database transaction. The earlier implementations above document the two
// accounting directions; this common implementation keeps the actual write
// path atomic and locks the invoice/bill against concurrent overpayment.
async function recordPayment(db, userId, targetId, body, type) {
  const amount = validateAmount(body.amount);
  if (!body.paymentDate) throw fail('Payment date is required.');
  if (!['CASH', 'BANK'].includes(body.method)) throw fail('Payment method must be Cash or Bank.');
  const isCustomer = type === 'CUSTOMER';
  const table = isCustomer ? 'customer_invoices' : 'vendor_bills';
  const targetColumn = isCustomer ? 'customer_invoice_id' : 'vendor_bill_id';
  const partyColumn = isCustomer ? 'customer_id' : 'vendor_id';
  const targetLabel = isCustomer ? 'Customer Invoice' : 'Vendor Bill';
  const counterpartCode = isCustomer ? '1003' : '2001';

  return withTransaction(db, async (tx) => {
    const target = await tx.query(`SELECT id, ${partyColumn} AS party_id, total_amount, status FROM ${table} WHERE id=$1 FOR UPDATE`, [targetId]);
    if (!target.rowCount) throw fail(`${targetLabel} not found.`, 404);
    const document = target.rows[0];
    if (document.status !== 'POSTED') throw fail(`Only a Posted ${targetLabel} can receive a payment.`);
    const paid = await tx.query(`SELECT COALESCE(SUM(amount),0)::text AS total FROM payments WHERE ${targetColumn}=$1 AND status='POSTED'`, [targetId]);
    const outstanding = Number(document.total_amount) - Number(paid.rows[0].total);
    if (outstanding <= 0) throw fail(`This ${targetLabel} is already fully paid.`);
    if (amount > outstanding) throw fail(`Payment amount cannot exceed the outstanding balance of ${outstanding.toFixed(2)}.`);

    const paymentJournalId = await cashOrBankAccount(tx, body.method);
    const accounts = await tx.query(`SELECT j.default_account_id AS "cashBankAccountId", (SELECT id FROM accounts WHERE account_code=$2 AND status='ACTIVE') AS "counterpartAccountId" FROM journals j WHERE j.id=$1`, [paymentJournalId, counterpartCode]);
    const { cashBankAccountId, counterpartAccountId } = accounts.rows[0];
    if (!counterpartAccountId) throw fail(`${isCustomer ? 'Debtors' : 'Creditors'} account (${counterpartCode}) must be configured before recording payments.`);
    const value = amount.toFixed(2);
    const entry = await accounting.createDraftEntry(tx, userId, { journalId: paymentJournalId, entryDate: body.paymentDate, reference: `Payment for ${targetId}`, description: isCustomer ? 'Customer payment received' : 'Vendor payment made', lines: isCustomer ? [
      { accountId: cashBankAccountId, debit: value, credit: '0.00' }, { accountId: counterpartAccountId, debit: '0.00', credit: value },
    ] : [
      { accountId: counterpartAccountId, debit: value, credit: '0.00' }, { accountId: cashBankAccountId, debit: '0.00', credit: value },
    ] });
    await accounting.postEntry(tx, entry.id, userId);
    const n = await tx.query("SELECT nextval('payment_number_seq') n");
    const id = randomUUID(); const paymentNumber = `PMT-${String(n.rows[0].n).padStart(6, '0')}`;
    await tx.query(`INSERT INTO payments (id,payment_number,type,contact_id,${targetColumn},payment_date,amount,method,reference,notes,accounting_entry_id,created_by_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [id, paymentNumber, type, document.party_id, targetId, body.paymentDate, value, body.method, body.reference?.trim() || null, body.notes?.trim() || null, entry.id, userId]);
    await tx.query(`UPDATE ${table} SET payment_status=$1,updated_at=NOW() WHERE id=$2`, [nextPaymentStatus(document.total_amount, Number(paid.rows[0].total) + amount), targetId]);
    await logAudit(tx, { userId, action: `${type}_PAYMENT_RECORDED`, entity: 'Payment', entityId: id, metadata: { paymentNumber, targetId, amount: value } });
    return getPayment(tx, id);
  });
}
const recordCustomerPayment = (db, userId, invoiceId, body) => recordPayment(db, userId, invoiceId, body, 'CUSTOMER');
const recordVendorPayment = (db, userId, billId, body) => recordPayment(db, userId, billId, body, 'VENDOR');

// Cancelling never mutates the original posted journal entry. It posts a
// reversing entry (debit/credit swapped) so the accounting trail always
// shows what actually happened, then recomputes the invoice/bill status
// from the remaining active payments.
async function cancelPayment(db, userId, id) {
  return withTransaction(db, async (tx) => {
  const payment = await getPayment(tx, id);
  if (!payment) throw fail('Payment not found.', 404);
  if (payment.status !== 'POSTED') throw fail('Only a Posted payment can be cancelled.');

  const original = await accounting.getEntry(tx, payment.accountingEntryId);
  const reversedLines = original.lines.map((line) => ({
    accountId: line.accountId,
    description: `Reversal of ${original.entryNumber}`,
    debit: line.credit,
    credit: line.debit,
    analyticAccountId: line.analyticAccountId || undefined,
  }));
  const reversalJournal = await tx.query('SELECT journal_id FROM journal_entries WHERE id = $1', [payment.accountingEntryId]);
  const reversal = await accounting.createDraftEntry(tx, userId, {
    journalId: reversalJournal.rows[0].journal_id,
    entryDate: new Date().toISOString().slice(0, 10),
    reference: `Reversal of ${original.entryNumber}`,
    description: `Cancellation of payment ${payment.paymentNumber}`,
    lines: reversedLines,
  });
  await accounting.postEntry(tx, reversal.id, userId);

    const r = await tx.query(
      "UPDATE payments SET status='CANCELLED', reversal_entry_id=$1, cancelled_by_id=$2, cancelled_at=NOW(), updated_at=NOW() WHERE id=$3 AND status='POSTED' RETURNING id",
      [reversal.id, userId, id],
    );
    if (!r.rowCount) throw fail('Payment could not be cancelled.');

    if (payment.customerInvoiceId) {
      const invoice = await tx.query('SELECT total_amount FROM customer_invoices WHERE id = $1', [payment.customerInvoiceId]);
      const remaining = await activePaymentsTotal(tx, 'customer_invoice_id', payment.customerInvoiceId);
      await tx.query('UPDATE customer_invoices SET payment_status = $1, updated_at = NOW() WHERE id = $2', [nextPaymentStatus(invoice.rows[0].total_amount, remaining), payment.customerInvoiceId]);
    } else if (payment.vendorBillId) {
      const bill = await tx.query('SELECT total_amount FROM vendor_bills WHERE id = $1', [payment.vendorBillId]);
      const remaining = await activePaymentsTotal(tx, 'vendor_bill_id', payment.vendorBillId);
      await tx.query('UPDATE vendor_bills SET payment_status = $1, updated_at = NOW() WHERE id = $2', [nextPaymentStatus(bill.rows[0].total_amount, remaining), payment.vendorBillId]);
    }

    const action = payment.type === 'CUSTOMER' ? 'CUSTOMER_PAYMENT_CANCELLED' : 'VENDOR_PAYMENT_CANCELLED';
    await logAudit(tx, { userId, action, entity: 'Payment', entityId: id, metadata: { reversalEntryId: reversal.id } });
    return getPayment(tx, id);
  });
}

async function getOutstanding(db, type, id) {
  const column = type === 'CUSTOMER' ? 'customer_invoice_id' : 'vendor_bill_id';
  const table = type === 'CUSTOMER' ? 'customer_invoices' : 'vendor_bills';
  const record = await db.query(`SELECT total_amount FROM ${table} WHERE id = $1`, [id]);
  if (!record.rowCount) return null;
  const paid = await activePaymentsTotal(db, column, id);
  return { totalAmount: Number(record.rows[0].total_amount).toFixed(2), amountPaid: paid.toFixed(2), outstandingAmount: (Number(record.rows[0].total_amount) - paid).toFixed(2) };
}

module.exports = {
  recordCustomerPayment,
  recordVendorPayment,
  cancelPayment,
  getPayment,
  getOutstanding,
  paymentSelect,
  paymentJoins,
};
