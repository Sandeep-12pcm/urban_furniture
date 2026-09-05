const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { seedAccountingFixtures, createContact, createProduct } = require('./helpers/fixtures');
const { login } = require('./helpers/authHelpers');

const amountFor = (rows, code) => rows.find((row) => row.accountCode === code)?.amount;

describe('Report reconciliation: purchase to sale workflow', () => {
  let pool;
  let app;
  let adminCookie;
  let accounts;
  let categoryId;
  let customerId;
  let vendorId;
  let productId;

  beforeAll(() => {
    pool = createTestPool();
    app = createApp(pool);
  });

  afterAll(async () => pool.end());

  beforeEach(async () => {
    await resetDatabase(pool);
    await createUser(pool, 'ADMIN', { loginId: 'admin' });
    adminCookie = await login(app, 'admin');
    ({ accountIds: accounts, categoryId } = await seedAccountingFixtures(pool));
    customerId = await createContact(pool, 'CUSTOMER', { name: 'Nimesh Pathak' });
    vendorId = await createContact(pool, 'VENDOR', { name: 'Azure Furniture' });
    productId = await createProduct(pool, categoryId, { name: 'Office Chair', salesPrice: 5000, purchasePrice: 4000 });
  });

  test('reconciles posted journals, ledgers, reports, inventory, and audit history', async () => {
    const purchaseOrder = await request(app).post('/api/purchases/orders').set('Cookie', adminCookie)
      .send({ vendorId, orderDate: '2026-09-05', lines: [{ productId, quantity: 10, unitPrice: 4000, taxRate: 18 }] }).expect(201);
    await request(app).post(`/api/purchases/orders/${purchaseOrder.body.purchaseOrder.id}/confirm`).set('Cookie', adminCookie).expect(200);
    const billDraft = await request(app).post('/api/purchases/bills').set('Cookie', adminCookie)
      .send({ vendorId, purchaseOrderId: purchaseOrder.body.purchaseOrder.id, invoiceDate: '2026-09-05', dueDate: '2026-09-20', lines: [{ productId, quantity: 10, unitPrice: 4000, taxRate: 18 }] }).expect(201);
    const bill = await request(app).post(`/api/purchases/bills/${billDraft.body.vendorBill.id}/post`).set('Cookie', adminCookie).expect(200);
    expect(bill.body.vendorBill.status).toBe('POSTED');
    const vendorPayment = await request(app).post(`/api/purchases/bills/${bill.body.vendorBill.id}/payments`).set('Cookie', adminCookie)
      .send({ amount: 47200, paymentDate: '2026-09-05', method: 'BANK' }).expect(201);
    expect(vendorPayment.body.payment.status).toBe('POSTED');

    const stockAfterPurchase = await request(app).get(`/api/inventory/${productId}`).set('Cookie', adminCookie).expect(200);
    expect(stockAfterPurchase.body.inventory.quantity).toBe('10.00');

    const entriesBeforeSalesOrder = await request(app).get('/api/journal-entries?limit=100').set('Cookie', adminCookie).expect(200);
    const salesOrder = await request(app).post('/api/sales/orders').set('Cookie', adminCookie)
      .send({ customerId, orderDate: '2026-09-05', items: [{ productId, quantity: 5, unitPrice: 5000, taxRate: 18 }] }).expect(201);
    await request(app).post(`/api/sales/orders/${salesOrder.body.salesOrder.id}/confirm`).set('Cookie', adminCookie).expect(200);
    const afterSalesOrder = await request(app).get('/api/journal-entries?limit=100').set('Cookie', adminCookie).expect(200);
    expect(afterSalesOrder.body.journalEntries).toHaveLength(entriesBeforeSalesOrder.body.journalEntries.length);

    const invoiceDraft = await request(app).post('/api/sales/invoices').set('Cookie', adminCookie)
      .send({ customerId, salesOrderId: salesOrder.body.salesOrder.id, invoiceDate: '2026-09-05', dueDate: '2026-09-20', items: [{ productId, quantity: 5, unitPrice: 5000, taxRate: 18 }] }).expect(201);
    expect(invoiceDraft.body.customerInvoice).toMatchObject({ status: 'DRAFT', subtotal: '25000.00', taxAmount: '4500.00', totalAmount: '29500.00' });
    const beforeInvoicePost = await request(app).get('/api/journal-entries?limit=100').set('Cookie', adminCookie).expect(200);
    const invoice = await request(app).post(`/api/sales/invoices/${invoiceDraft.body.customerInvoice.id}/post`).set('Cookie', adminCookie).expect(200);
    expect(invoice.body.customerInvoice.status).toBe('POSTED');
    const invoiceEntry = await request(app).get(`/api/journal-entries/${invoice.body.customerInvoice.accountingEntryId}`).set('Cookie', adminCookie).expect(200);
    expect(invoiceEntry.body.journalEntry).toMatchObject({ balanced: true, totalDebit: '29500.00', totalCredit: '29500.00' });
    expect(invoiceEntry.body.journalEntry.lines.find((line) => line.accountCode === '1003').debit).toBe('29500.00');
    expect(invoiceEntry.body.journalEntry.lines.find((line) => line.accountCode === '4001').credit).toBe('25000.00');
    expect(invoiceEntry.body.journalEntry.lines.find((line) => line.accountCode === '2002').credit).toBe('4500.00');
    const afterInvoicePost = await request(app).get('/api/journal-entries?limit=100').set('Cookie', adminCookie).expect(200);
    expect(afterInvoicePost.body.journalEntries).toHaveLength(beforeInvoicePost.body.journalEntries.length + 1);

    const customerPayment = await request(app).post(`/api/sales/invoices/${invoice.body.customerInvoice.id}/payments`).set('Cookie', adminCookie)
      .send({ amount: 29500, paymentDate: '2026-09-05', method: 'BANK' }).expect(201);
    const paidInvoice = await request(app).get(`/api/sales/invoices/${invoice.body.customerInvoice.id}`).set('Cookie', adminCookie).expect(200);
    expect(paidInvoice.body.customerInvoice.paymentStatus).toBe('PAID');
    const receiptEntry = await request(app).get(`/api/journal-entries/${customerPayment.body.payment.accountingEntryId}`).set('Cookie', adminCookie).expect(200);
    expect(receiptEntry.body.journalEntry).toMatchObject({ balanced: true, totalDebit: '29500.00', totalCredit: '29500.00' });

    const movements = await request(app).get(`/api/inventory/${productId}/movements?limit=20`).set('Cookie', adminCookie).expect(200);
    expect(movements.body.movements.map((movement) => [movement.movementType, movement.quantity])).toEqual(expect.arrayContaining([['STOCK_IN', '10.00'], ['STOCK_OUT', '5.00']]));
    const finalStock = await request(app).get(`/api/inventory/${productId}`).set('Cookie', adminCookie).expect(200);
    expect(finalStock.body.inventory.quantity).toBe('5.00');

    const ledger = async (accountId) => (await request(app).get(`/api/reports/general-ledger?accountId=${accountId}&limit=100`).set('Cookie', adminCookie).expect(200)).body;
    const salesLedger = await ledger(accounts['4001']);
    const receivableLedger = await ledger(accounts['1003']);
    expect(salesLedger.transactions.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(25000);
    expect(salesLedger.closingBalance).toBe('-25000.00');
    expect(receivableLedger.transactions.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(29500);
    expect(receivableLedger.transactions.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(29500);
    expect(receivableLedger.closingBalance).toBe('0.00');

    const trialBalance = await request(app).get('/api/reports/trial-balance').set('Cookie', adminCookie).expect(200);
    expect(trialBalance.body.totals).toMatchObject({ debit: trialBalance.body.totals.credit, balanced: true });
    const profitLoss = await request(app).get('/api/reports/profit-loss').set('Cookie', adminCookie).expect(200);
    expect(profitLoss.body.totalRevenue).toBe('25000.00');
    expect(amountFor(profitLoss.body.income, '4001')).toBe('25000.00');
    expect(amountFor(profitLoss.body.income, '2002')).toBeUndefined();
    expect(profitLoss.body.totalExpenses).toBe('47200.00');
    const balanceSheet = await request(app).get('/api/reports/balance-sheet').set('Cookie', adminCookie).expect(200);
    expect(balanceSheet.body.balanced).toBe(true);
    expect(amountFor(balanceSheet.body.assets, '1002')).toBe('-17700.00');
    expect(amountFor(balanceSheet.body.assets, '1003')).toBe('0.00');
    expect(amountFor(balanceSheet.body.liabilities, '2001')).toBe('0.00');
    expect(amountFor(balanceSheet.body.liabilities, '2002')).toBe('4500.00');

    // BI derives from the same posted documents and journals, never a separate
    // reporting store. These assertions make that reconciliation executable.
    const [receivables, payables, cashFlow, trends] = await Promise.all([
      request(app).get('/api/analytics/receivables').set('Cookie', adminCookie).expect(200),
      request(app).get('/api/analytics/payables').set('Cookie', adminCookie).expect(200),
      request(app).get('/api/analytics/cash-flow?startDate=2026-09-05&endDate=2026-09-05').set('Cookie', adminCookie).expect(200),
      request(app).get('/api/analytics/trends?startDate=2026-09-01&endDate=2026-09-30').set('Cookie', adminCookie).expect(200),
    ]);
    expect(receivables.body).toMatchObject({ outstanding: '0', outstandingCount: 0, paidCount: 1 });
    expect(payables.body).toMatchObject({ outstanding: '0', outstandingCount: 0, paidCount: 1 });
    expect(cashFlow.body).toMatchObject({ inflows: '29500.00', outflows: '47200.00', netCashFlow: '-17700.00' });
    expect(trends.body.trend).toEqual(expect.arrayContaining([expect.objectContaining({ period: '2026-09-01', revenue: '25000.00', expenses: '47200.00' })]));

    const audit = await request(app).get('/api/admin/audit-logs?limit=200').set('Cookie', adminCookie).expect(200);
    const actions = audit.body.auditLogs.map((row) => row.action);
    expect(actions).toEqual(expect.arrayContaining(['VENDOR_BILL_POSTED', 'VENDOR_PAYMENT_RECORDED', 'STOCK_IN_CREATED', 'CUSTOMER_INVOICE_POSTED', 'CUSTOMER_PAYMENT_RECORDED', 'STOCK_OUT_CREATED']));
  });

  // Regression: reportingService's LEFT JOIN aggregates must filter by
  // FILTER(WHERE ...) on the aggregate, never by attaching the status/date
  // condition to the second JOIN's own ON clause — that pattern still sums
  // a DRAFT or CANCELLED entry's lines (the entry-level join fails, but the
  // line-level join already matched). A single un-posted draft entry must
  // never move Trial Balance, P&L, or Balance Sheet totals.
  test('draft journal entries never leak into Trial Balance, P&L, or Balance Sheet', async () => {
    const before = await Promise.all([
      request(app).get('/api/reports/trial-balance').set('Cookie', adminCookie).expect(200),
      request(app).get('/api/reports/profit-loss').set('Cookie', adminCookie).expect(200),
      request(app).get('/api/reports/balance-sheet').set('Cookie', adminCookie).expect(200),
    ]);

    const draft = await request(app).post('/api/journal-entries').set('Cookie', adminCookie).send({
      journalId: (await pool.query("SELECT id FROM journals WHERE type='CASH'")).rows[0].id,
      entryDate: '2026-09-05',
      lines: [
        { accountId: accounts['5001'], debit: '999999.00', credit: '0.00' },
        { accountId: accounts['1001'], debit: '0.00', credit: '999999.00' },
      ],
    }).expect(201);
    expect(draft.body.journalEntry.status).toBe('DRAFT');

    const after = await Promise.all([
      request(app).get('/api/reports/trial-balance').set('Cookie', adminCookie).expect(200),
      request(app).get('/api/reports/profit-loss').set('Cookie', adminCookie).expect(200),
      request(app).get('/api/reports/balance-sheet').set('Cookie', adminCookie).expect(200),
    ]);

    expect(after[0].body.totals).toEqual(before[0].body.totals);
    expect(after[1].body.totalExpenses).toBe(before[1].body.totalExpenses);
    expect(after[2].body).toMatchObject({ totalAssets: before[2].body.totalAssets, balanced: true });
    expect(after[2].body.balanced).toBe(true);

    // Posting it, however, must move all three exactly by the entry amount.
    await request(app).post(`/api/journal-entries/${draft.body.journalEntry.id}/post`).set('Cookie', adminCookie).expect(200);
    const posted = await request(app).get('/api/reports/profit-loss').set('Cookie', adminCookie).expect(200);
    expect(Number(posted.body.totalExpenses)).toBe(Number(before[1].body.totalExpenses) + 999999);
  });
});
