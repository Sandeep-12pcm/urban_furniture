const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { seedAccountingFixtures, createContact, createProduct } = require('./helpers/fixtures');
const { login } = require('./helpers/authHelpers');

describe('Payments (customer receipts and vendor payments)', () => {
  let pool;
  let app;
  let adminCookie;
  let fixtures;
  let customerId;
  let vendorId;
  let productId;

  beforeAll(() => {
    pool = createTestPool();
    app = createApp(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await resetDatabase(pool);
    await createUser(pool, 'ADMIN', { loginId: 'admin' });
    await createUser(pool, 'CONTACT', { loginId: 'contact' });
    adminCookie = await login(app, 'admin');
    fixtures = await seedAccountingFixtures(pool);
    customerId = await createContact(pool, 'CUSTOMER', { name: 'Nimesh Pathak' });
    vendorId = await createContact(pool, 'VENDOR', { name: 'Furniture Supplies Co' });
    productId = await createProduct(pool, fixtures.categoryId, { name: 'Office Chair', salesPrice: 5000, purchasePrice: 3500 });
    await request(app).post('/api/inventory/adjustments').set('Cookie', adminCookie)
      .send({ productId, direction: 'IN', quantity: 100, reason: 'Test opening stock' }).expect(201);
  });

  async function postedInvoice(amountQty = 1, unitPrice = 10000, taxRate = 0) {
    const invoice = await request(app)
      .post('/api/sales/invoices')
      .set('Cookie', adminCookie)
      .send({ customerId, invoiceDate: '2026-09-05', dueDate: '2026-09-20', items: [{ productId, quantity: amountQty, unitPrice, taxRate }] });
    const posted = await request(app).post(`/api/sales/invoices/${invoice.body.customerInvoice.id}/post`).set('Cookie', adminCookie);
    return posted.body.customerInvoice;
  }

  async function postedBill(amountQty = 1, unitPrice = 10000, taxRate = 0) {
    const po = await request(app)
      .post('/api/purchases/orders')
      .set('Cookie', adminCookie)
      .send({ vendorId, orderDate: '2026-09-05', lines: [{ productId, quantity: amountQty, unitPrice, taxRate }] });
    await request(app).post(`/api/purchases/orders/${po.body.purchaseOrder.id}/confirm`).set('Cookie', adminCookie);
    const prefill = await request(app).get(`/api/purchases/bills/from-order/${po.body.purchaseOrder.id}`).set('Cookie', adminCookie);
    const bill = await request(app).post('/api/purchases/bills').set('Cookie', adminCookie).send(prefill.body.vendorBill);
    const posted = await request(app).post(`/api/purchases/bills/${bill.body.vendorBill.id}/post`).set('Cookie', adminCookie);
    return posted.body.vendorBill;
  }

  test('records a full customer payment: Debit Cash/Bank, Credit Debtors, invoice becomes PAID', async () => {
    const invoice = await postedInvoice(1, 10000);

    const payment = await request(app)
      .post(`/api/sales/invoices/${invoice.id}/payments`)
      .set('Cookie', adminCookie)
      .send({ amount: 10000, paymentDate: '2026-09-05', method: 'BANK' })
      .expect(201);
    expect(payment.body.payment.status).toBe('POSTED');

    const entry = await request(app).get(`/api/journal-entries/${payment.body.payment.accountingEntryId}`).set('Cookie', adminCookie);
    expect(entry.body.journalEntry.balanced).toBe(true);
    const bankLine = entry.body.journalEntry.lines.find((l) => l.accountCode === '1002');
    const debtorsLine = entry.body.journalEntry.lines.find((l) => l.accountCode === '1003');
    expect(bankLine.debit).toBe('10000.00');
    expect(debtorsLine.credit).toBe('10000.00');

    const invoiceAfter = await request(app).get(`/api/sales/invoices/${invoice.id}`).set('Cookie', adminCookie);
    expect(invoiceAfter.body.customerInvoice.paymentStatus).toBe('PAID');
  });

  test('supports a partial customer payment, prevents overpayment, and settles the remainder', async () => {
    const invoice = await postedInvoice(1, 10000);

    await request(app).post(`/api/sales/invoices/${invoice.id}/payments`).set('Cookie', adminCookie).send({ amount: 4000, paymentDate: '2026-09-05', method: 'CASH' }).expect(201);
    let after = await request(app).get(`/api/sales/invoices/${invoice.id}`).set('Cookie', adminCookie);
    expect(after.body.customerInvoice.paymentStatus).toBe('PARTIALLY_PAID');

    const outstanding = await request(app).get(`/api/sales/invoices/${invoice.id}/outstanding`).set('Cookie', adminCookie);
    expect(outstanding.body.outstandingAmount).toBe('6000.00');

    await request(app)
      .post(`/api/sales/invoices/${invoice.id}/payments`)
      .set('Cookie', adminCookie)
      .send({ amount: 9999, paymentDate: '2026-09-05', method: 'CASH' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toContain('cannot exceed the outstanding balance'));

    await request(app).post(`/api/sales/invoices/${invoice.id}/payments`).set('Cookie', adminCookie).send({ amount: 6000, paymentDate: '2026-09-05', method: 'CASH' }).expect(201);
    after = await request(app).get(`/api/sales/invoices/${invoice.id}`).set('Cookie', adminCookie);
    expect(after.body.customerInvoice.paymentStatus).toBe('PAID');

    await request(app)
      .post(`/api/sales/invoices/${invoice.id}/payments`)
      .set('Cookie', adminCookie)
      .send({ amount: 1, paymentDate: '2026-09-05', method: 'CASH' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('This Customer Invoice is already fully paid.'));
  });

  test('records a vendor payment: Debit Creditors, Credit Cash/Bank, bill becomes PAID', async () => {
    const bill = await postedBill(1, 6720, 0);

    const payment = await request(app)
      .post(`/api/purchases/bills/${bill.id}/payments`)
      .set('Cookie', adminCookie)
      .send({ amount: 6720, paymentDate: '2026-09-05', method: 'BANK' })
      .expect(201);

    const entry = await request(app).get(`/api/journal-entries/${payment.body.payment.accountingEntryId}`).set('Cookie', adminCookie);
    const creditorsLine = entry.body.journalEntry.lines.find((l) => l.accountCode === '2001');
    const bankLine = entry.body.journalEntry.lines.find((l) => l.accountCode === '1002');
    expect(creditorsLine.debit).toBe('6720.00');
    expect(bankLine.credit).toBe('6720.00');

    const billAfter = await request(app).get(`/api/purchases/bills/${bill.id}`).set('Cookie', adminCookie);
    expect(billAfter.body.vendorBill.paymentStatus || billAfter.body.vendorBill.payment_status).toBe('PAID');
  });

  test('cannot pay a DRAFT invoice/bill, and cannot pay with a zero or negative amount', async () => {
    const draftInvoice = await request(app)
      .post('/api/sales/invoices')
      .set('Cookie', adminCookie)
      .send({ customerId, invoiceDate: '2026-09-05', dueDate: '2026-09-20', items: [{ productId, quantity: 1, unitPrice: 100, taxRate: 0 }] });

    await request(app)
      .post(`/api/sales/invoices/${draftInvoice.body.customerInvoice.id}/payments`)
      .set('Cookie', adminCookie)
      .send({ amount: 100, paymentDate: '2026-09-05', method: 'CASH' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Only a Posted Customer Invoice can receive a payment.'));

    const invoice = await postedInvoice(1, 1000);
    await request(app)
      .post(`/api/sales/invoices/${invoice.id}/payments`)
      .set('Cookie', adminCookie)
      .send({ amount: 0, paymentDate: '2026-09-05', method: 'CASH' })
      .expect(400);
    await request(app)
      .post(`/api/sales/invoices/${invoice.id}/payments`)
      .set('Cookie', adminCookie)
      .send({ amount: -50, paymentDate: '2026-09-05', method: 'CASH' })
      .expect(400);
  });

  test('cancelling a payment posts a reversing entry, never mutates the original, and recomputes payment status', async () => {
    const invoice = await postedInvoice(1, 10000);
    const payment = await request(app)
      .post(`/api/sales/invoices/${invoice.id}/payments`)
      .set('Cookie', adminCookie)
      .send({ amount: 10000, paymentDate: '2026-09-05', method: 'BANK' });
    const paymentId = payment.body.payment.id;
    const originalEntryId = payment.body.payment.accountingEntryId;

    const cancelled = await request(app).post(`/api/payments/${paymentId}/cancel`).set('Cookie', adminCookie).expect(200);
    expect(cancelled.body.payment.status).toBe('CANCELLED');
    const reversalId = cancelled.body.payment.reversalEntryId;
    expect(reversalId).toBeTruthy();

    const original = await request(app).get(`/api/journal-entries/${originalEntryId}`).set('Cookie', adminCookie);
    expect(original.body.journalEntry.status).toBe('POSTED'); // never mutated
    const reversal = await request(app).get(`/api/journal-entries/${reversalId}`).set('Cookie', adminCookie);
    expect(reversal.body.journalEntry.balanced).toBe(true);
    const reversedBankLine = reversal.body.journalEntry.lines.find((l) => l.accountCode === '1002');
    expect(reversedBankLine.credit).toBe('10000.00'); // swapped vs. the original debit

    const invoiceAfter = await request(app).get(`/api/sales/invoices/${invoice.id}`).set('Cookie', adminCookie);
    expect(invoiceAfter.body.customerInvoice.paymentStatus).toBe('UNPAID');

    await request(app).post(`/api/payments/${paymentId}/cancel`).set('Cookie', adminCookie).expect(400);
  });

  test('unauthenticated and CONTACT role are rejected', async () => {
    const invoice = await postedInvoice(1, 1000);
    await request(app).post(`/api/sales/invoices/${invoice.id}/payments`).send({ amount: 1000, paymentDate: '2026-09-05', method: 'CASH' }).expect(401);
    const contactCookie = await login(app, 'contact');
    await request(app).get('/api/payments').set('Cookie', contactCookie).expect(403);
  });
});
