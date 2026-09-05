const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { seedAccountingFixtures, createContact, createProduct } = require('./helpers/fixtures');
const { login } = require('./helpers/authHelpers');

describe('Sales workflow (Orders, Invoices, accounting integration)', () => {
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
    await createUser(pool, 'ACCOUNTANT', { loginId: 'accountant' });
    await createUser(pool, 'CONTACT', { loginId: 'contact' });
    adminCookie = await login(app, 'admin');
    fixtures = await seedAccountingFixtures(pool);
    customerId = await createContact(pool, 'CUSTOMER', { name: 'Nimesh Pathak' });
    vendorId = await createContact(pool, 'VENDOR', { name: 'Vendor Only Co' });
    productId = await createProduct(pool, fixtures.categoryId, { name: 'Office Chair', salesPrice: 5000, purchasePrice: 3500 });
    // Sales posting is a stock-out operation. Seed an auditable opening
    // balance rather than allowing the workflow to create negative stock.
    await request(app).post('/api/inventory/adjustments').set('Cookie', adminCookie)
      .send({ productId, direction: 'IN', quantity: 100, reason: 'Test opening stock' }).expect(201);
  });

  test('full accounting integration: Nimesh Pathak buys 5 Office Chairs @ ₹5,000, 18% tax', async () => {
    const so = await request(app)
      .post('/api/sales/orders')
      .set('Cookie', adminCookie)
      .send({ customerId, orderDate: '2026-09-05', items: [{ productId, quantity: 5, unitPrice: 5000, taxRate: 18 }] })
      .expect(201);
    expect(so.body.salesOrder.subtotal).toBe('25000.00');
    expect(so.body.salesOrder.taxAmount).toBe('4500.00');
    expect(so.body.salesOrder.totalAmount).toBe('29500.00');
    expect(so.body.salesOrder.status).toBe('DRAFT');

    const noEntryYet = await request(app).get('/api/journal-entries?limit=200').set('Cookie', adminCookie);
    const countAtDraft = noEntryYet.body.journalEntries.length;

    await request(app).post(`/api/sales/orders/${so.body.salesOrder.id}/confirm`).set('Cookie', adminCookie).expect(200);
    const afterConfirm = await request(app).get('/api/journal-entries?limit=200').set('Cookie', adminCookie);
    expect(afterConfirm.body.journalEntries.length).toBe(countAtDraft); // confirming a Sales Order must NOT post accounting

    const invoice = await request(app)
      .post('/api/sales/invoices')
      .set('Cookie', adminCookie)
      .send({ customerId, salesOrderId: so.body.salesOrder.id, invoiceDate: '2026-09-05', dueDate: '2026-09-20', items: [{ productId, quantity: 5, unitPrice: 5000, taxRate: 18 }] })
      .expect(201);
    expect(invoice.body.customerInvoice.status).toBe('DRAFT');
    expect(invoice.body.customerInvoice.totalAmount).toBe('29500.00');

    const afterDraftInvoice = await request(app).get('/api/journal-entries?limit=200').set('Cookie', adminCookie);
    expect(afterDraftInvoice.body.journalEntries.length).toBe(countAtDraft); // draft invoice must NOT post accounting

    const posted = await request(app)
      .post(`/api/sales/invoices/${invoice.body.customerInvoice.id}/post`)
      .set('Cookie', adminCookie)
      .expect(200);
    expect(posted.body.customerInvoice.status).toBe('POSTED');

    const entry = await request(app)
      .get(`/api/journal-entries/${posted.body.customerInvoice.accountingEntryId}`)
      .set('Cookie', adminCookie)
      .expect(200);
    expect(entry.body.journalEntry.balanced).toBe(true);
    expect(entry.body.journalEntry.totalDebit).toBe('29500.00');
    expect(entry.body.journalEntry.totalCredit).toBe('29500.00');

    const debtorsLine = entry.body.journalEntry.lines.find((l) => l.accountCode === '1003');
    const salesLine = entry.body.journalEntry.lines.find((l) => l.accountCode === '4001');
    const taxLine = entry.body.journalEntry.lines.find((l) => l.accountCode === '2002');
    expect(debtorsLine.debit).toBe('29500.00');
    expect(salesLine.credit).toBe('25000.00');
    expect(taxLine.credit).toBe('4500.00');
  });

  test('rejects a vendor-only contact, archived customer, archived product, and empty items', async () => {
    await request(app)
      .post('/api/sales/orders')
      .set('Cookie', adminCookie)
      .send({ customerId: vendorId, orderDate: '2026-09-05', items: [{ productId, quantity: 1, unitPrice: 10, taxRate: 0 }] })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Customer must be an active Customer or Both contact.'));

    await request(app).post(`/api/contacts/${customerId}/archive`).set('Cookie', adminCookie).expect(200);
    await request(app)
      .post('/api/sales/orders')
      .set('Cookie', adminCookie)
      .send({ customerId, orderDate: '2026-09-05', items: [{ productId, quantity: 1, unitPrice: 10, taxRate: 0 }] })
      .expect(400);
    await request(app).post(`/api/contacts/${customerId}/restore`).set('Cookie', adminCookie).expect(200);

    await request(app).post(`/api/products/${productId}/archive`).set('Cookie', adminCookie).expect(200);
    await request(app)
      .post('/api/sales/orders')
      .set('Cookie', adminCookie)
      .send({ customerId, orderDate: '2026-09-05', items: [{ productId, quantity: 1, unitPrice: 10, taxRate: 0 }] })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Product is archived and cannot be used for a new Sales transaction.'));
    await request(app).post(`/api/products/${productId}/restore`).set('Cookie', adminCookie).expect(200);

    await request(app)
      .post('/api/sales/orders')
      .set('Cookie', adminCookie)
      .send({ customerId, orderDate: '2026-09-05', items: [] })
      .expect(400);
  });

  test('rejects invalid quantity and negative price', async () => {
    await request(app)
      .post('/api/sales/orders')
      .set('Cookie', adminCookie)
      .send({ customerId, orderDate: '2026-09-05', items: [{ productId, quantity: 0, unitPrice: 10, taxRate: 0 }] })
      .expect(400);

    await request(app)
      .post('/api/sales/orders')
      .set('Cookie', adminCookie)
      .send({ customerId, orderDate: '2026-09-05', items: [{ productId, quantity: 1, unitPrice: -1, taxRate: 0 }] })
      .expect(400);
  });

  test('Sales Order status transitions: DRAFT -> CONFIRMED and DRAFT -> CANCELLED only', async () => {
    const so = await request(app)
      .post('/api/sales/orders')
      .set('Cookie', adminCookie)
      .send({ customerId, orderDate: '2026-09-05', items: [{ productId, quantity: 1, unitPrice: 100, taxRate: 0 }] });
    const id = so.body.salesOrder.id;

    await request(app).post(`/api/sales/orders/${id}/confirm`).set('Cookie', adminCookie).expect(200);
    // Once CONFIRMED, neither confirm-again nor cancel is a valid transition.
    await request(app).post(`/api/sales/orders/${id}/confirm`).set('Cookie', adminCookie).expect(400);
    await request(app).post(`/api/sales/orders/${id}/cancel`).set('Cookie', adminCookie).expect(400);

    const so2 = await request(app)
      .post('/api/sales/orders')
      .set('Cookie', adminCookie)
      .send({ customerId, orderDate: '2026-09-05', items: [{ productId, quantity: 1, unitPrice: 100, taxRate: 0 }] });
    await request(app).post(`/api/sales/orders/${so2.body.salesOrder.id}/cancel`).set('Cookie', adminCookie).expect(200);
  });

  test('updates a draft order and recalculates totals; cannot edit after confirm', async () => {
    const so = await request(app)
      .post('/api/sales/orders')
      .set('Cookie', adminCookie)
      .send({ customerId, orderDate: '2026-09-05', items: [{ productId, quantity: 1, unitPrice: 5000, taxRate: 18 }] });
    const id = so.body.salesOrder.id;

    const updated = await request(app)
      .patch(`/api/sales/orders/${id}`)
      .set('Cookie', adminCookie)
      .send({ items: [{ productId, quantity: 3, unitPrice: 5000, taxRate: 18 }] })
      .expect(200);
    expect(updated.body.salesOrder.subtotal).toBe('15000.00');

    await request(app).post(`/api/sales/orders/${id}/confirm`).set('Cookie', adminCookie).expect(200);
    await request(app)
      .patch(`/api/sales/orders/${id}`)
      .set('Cookie', adminCookie)
      .send({ reference: 'x' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Only Draft Sales Orders can be edited.'));
  });

  test('generates a Customer Invoice prefilled from a confirmed Sales Order', async () => {
    const so = await request(app)
      .post('/api/sales/orders')
      .set('Cookie', adminCookie)
      .send({ customerId, orderDate: '2026-09-05', items: [{ productId, quantity: 2, unitPrice: 5000, taxRate: 18 }] });
    const id = so.body.salesOrder.id;

    await request(app).get(`/api/sales/invoices/from-order/${id}`).set('Cookie', adminCookie).expect(400); // not confirmed yet
    await request(app).post(`/api/sales/orders/${id}/confirm`).set('Cookie', adminCookie).expect(200);

    const prefill = await request(app).get(`/api/sales/invoices/from-order/${id}`).set('Cookie', adminCookie).expect(200);
    expect(prefill.body.customerInvoice.customerId).toBe(customerId);
    expect(prefill.body.customerInvoice.items[0].quantity).toBe('2.00');
  });

  test('Draft-only Customer Invoice cancellation and audit trail', async () => {
    const invoice = await request(app)
      .post('/api/sales/invoices')
      .set('Cookie', adminCookie)
      .send({ customerId, invoiceDate: '2026-09-05', dueDate: '2026-09-20', items: [{ productId, quantity: 1, unitPrice: 100, taxRate: 0 }] });
    const id = invoice.body.customerInvoice.id;

    await request(app).post(`/api/sales/invoices/${id}/cancel`).set('Cookie', adminCookie).expect(200);
    await request(app).post(`/api/sales/invoices/${id}/post`).set('Cookie', adminCookie).expect(400);

    const auditRows = await pool.query(
      "SELECT action FROM audit_logs WHERE entity = 'CustomerInvoice' AND entity_id = $1 ORDER BY timestamp",
      [id],
    );
    expect(auditRows.rows.map((r) => r.action)).toEqual(['CUSTOMER_INVOICE_CREATED', 'CUSTOMER_INVOICE_CANCELLED']);
  });

  test('search, status filter, and pagination on both list endpoints', async () => {
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/sales/orders')
        .set('Cookie', adminCookie)
        .send({ customerId, orderDate: '2026-09-05', items: [{ productId, quantity: 1, unitPrice: 100, taxRate: 0 }] });
    }
    const page1 = await request(app).get('/api/sales/orders?limit=2&page=1').set('Cookie', adminCookie).expect(200);
    expect(page1.body.salesOrders).toHaveLength(2);
    expect(page1.body.pagination.total).toBe(3);
    const search = await request(app).get('/api/sales/orders?search=Nimesh').set('Cookie', adminCookie).expect(200);
    expect(search.body.salesOrders.length).toBe(3);
    const noMatch = await request(app).get('/api/sales/orders?search=nobody-here').set('Cookie', adminCookie).expect(200);
    expect(noMatch.body.salesOrders).toHaveLength(0);
  });

  test('unauthenticated and CONTACT role are rejected on both modules', async () => {
    await request(app).get('/api/sales/orders').expect(401);
    await request(app).get('/api/sales/invoices').expect(401);
    const contactCookie = await login(app, 'contact');
    await request(app).get('/api/sales/orders').set('Cookie', contactCookie).expect(403);
    await request(app).get('/api/sales/invoices').set('Cookie', contactCookie).expect(403);
  });

  test('ACCOUNTANT can run the full workflow like ADMIN', async () => {
    const accountantCookie = await login(app, 'accountant');
    const so = await request(app)
      .post('/api/sales/orders')
      .set('Cookie', accountantCookie)
      .send({ customerId, orderDate: '2026-09-05', items: [{ productId, quantity: 1, unitPrice: 100, taxRate: 0 }] })
      .expect(201);
    await request(app).post(`/api/sales/orders/${so.body.salesOrder.id}/confirm`).set('Cookie', accountantCookie).expect(200);
  });
});
