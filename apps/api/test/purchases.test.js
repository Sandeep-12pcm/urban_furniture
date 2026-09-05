const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { seedAccountingFixtures, createContact, createProduct } = require('./helpers/fixtures');
const { login } = require('./helpers/authHelpers');

describe('Purchase workflow (Orders, Bills, accounting integration)', () => {
  let pool;
  let app;
  let adminCookie;
  let fixtures;
  let vendorId;
  let customerId;
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
    vendorId = await createContact(pool, 'VENDOR', { name: 'Furniture Supplies Co' });
    customerId = await createContact(pool, 'CUSTOMER', { name: 'Customer Only Co' });
    productId = await createProduct(pool, fixtures.categoryId, { name: 'Raw Timber', salesPrice: 100, purchasePrice: 2000 });
  });

  test('full accounting integration: PO -> confirm -> Vendor Bill from order -> post, balanced entry', async () => {
    const po = await request(app)
      .post('/api/purchases/orders')
      .set('Cookie', adminCookie)
      .send({ vendorId, orderDate: '2026-09-05', lines: [{ productId, quantity: 3, unitPrice: 2000, taxRate: 12 }] })
      .expect(201);
    expect(po.body.purchaseOrder.subtotal).toBe('6000.00');
    expect(po.body.purchaseOrder.taxAmount).toBe('720.00');
    expect(po.body.purchaseOrder.totalAmount).toBe('6720.00');

    await request(app).post(`/api/purchases/orders/${po.body.purchaseOrder.id}/confirm`).set('Cookie', adminCookie).expect(200);
    const beforeBill = await request(app).get('/api/journal-entries?limit=200').set('Cookie', adminCookie);

    const prefill = await request(app).get(`/api/purchases/bills/from-order/${po.body.purchaseOrder.id}`).set('Cookie', adminCookie).expect(200);
    const bill = await request(app).post('/api/purchases/bills').set('Cookie', adminCookie).send(prefill.body.vendorBill).expect(201);
    expect(bill.body.vendorBill.status).toBe('DRAFT');

    const afterDraftBill = await request(app).get('/api/journal-entries?limit=200').set('Cookie', adminCookie);
    expect(afterDraftBill.body.journalEntries.length).toBe(beforeBill.body.journalEntries.length);

    const posted = await request(app).post(`/api/purchases/bills/${bill.body.vendorBill.id}/post`).set('Cookie', adminCookie).expect(200);
    expect(posted.body.vendorBill.status).toBe('POSTED');

    const entryId = posted.body.vendorBill.accountingEntryId || posted.body.vendorBill.accounting_entry_id;
    const entry = await request(app).get(`/api/journal-entries/${entryId}`).set('Cookie', adminCookie).expect(200);
    expect(entry.body.journalEntry.balanced).toBe(true);
    expect(entry.body.journalEntry.totalDebit).toBe('6720.00');
    expect(entry.body.journalEntry.totalCredit).toBe('6720.00');
    const expenseLine = entry.body.journalEntry.lines.find((l) => l.accountCode === '5001');
    const creditorsLine = entry.body.journalEntry.lines.find((l) => l.accountCode === '2001');
    expect(expenseLine.debit).toBe('6720.00');
    expect(creditorsLine.credit).toBe('6720.00');
  });

  test('rejects a customer-only contact, archived vendor, archived product, and empty lines', async () => {
    await request(app)
      .post('/api/purchases/orders')
      .set('Cookie', adminCookie)
      .send({ vendorId: customerId, orderDate: '2026-09-05', lines: [{ productId, quantity: 1, unitPrice: 10, taxRate: 0 }] })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Vendor must be an active Vendor or Both contact.'));

    await request(app).post(`/api/contacts/${vendorId}/archive`).set('Cookie', adminCookie).expect(200);
    await request(app)
      .post('/api/purchases/orders')
      .set('Cookie', adminCookie)
      .send({ vendorId, orderDate: '2026-09-05', lines: [{ productId, quantity: 1, unitPrice: 10, taxRate: 0 }] })
      .expect(400);
    await request(app).post(`/api/contacts/${vendorId}/restore`).set('Cookie', adminCookie).expect(200);

    await request(app).post(`/api/products/${productId}/archive`).set('Cookie', adminCookie).expect(200);
    await request(app)
      .post('/api/purchases/orders')
      .set('Cookie', adminCookie)
      .send({ vendorId, orderDate: '2026-09-05', lines: [{ productId, quantity: 1, unitPrice: 10, taxRate: 0 }] })
      .expect(400);
    await request(app).post(`/api/products/${productId}/restore`).set('Cookie', adminCookie).expect(200);

    await request(app)
      .post('/api/purchases/orders')
      .set('Cookie', adminCookie)
      .send({ vendorId, orderDate: '2026-09-05', lines: [] })
      .expect(400);
  });

  test('a Vendor Bill can only be created against a CONFIRMED order belonging to the same vendor', async () => {
    const po = await request(app)
      .post('/api/purchases/orders')
      .set('Cookie', adminCookie)
      .send({ vendorId, orderDate: '2026-09-05', lines: [{ productId, quantity: 1, unitPrice: 100, taxRate: 0 }] });

    await request(app)
      .post('/api/purchases/bills')
      .set('Cookie', adminCookie)
      .send({ vendorId, purchaseOrderId: po.body.purchaseOrder.id, invoiceDate: '2026-09-05', dueDate: '2026-09-05', lines: [{ productId, quantity: 1, unitPrice: 100, taxRate: 0 }] })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Purchase Order must be confirmed and belong to this vendor.'));
  });

  test('order and bill status transitions and draft-only editing', async () => {
    const po = await request(app)
      .post('/api/purchases/orders')
      .set('Cookie', adminCookie)
      .send({ vendorId, orderDate: '2026-09-05', lines: [{ productId, quantity: 1, unitPrice: 100, taxRate: 0 }] });
    const id = po.body.purchaseOrder.id;

    await request(app)
      .patch(`/api/purchases/orders/${id}`)
      .set('Cookie', adminCookie)
      .send({ lines: [{ productId, quantity: 5, unitPrice: 100, taxRate: 0 }] })
      .expect(200)
      .expect(({ body }) => expect(body.purchaseOrder.subtotal).toBe('500.00'));

    await request(app).post(`/api/purchases/orders/${id}/confirm`).set('Cookie', adminCookie).expect(200);
    await request(app).post(`/api/purchases/orders/${id}/confirm`).set('Cookie', adminCookie).expect(400);
    await request(app).post(`/api/purchases/orders/${id}/cancel`).set('Cookie', adminCookie).expect(400);
    await request(app).patch(`/api/purchases/orders/${id}`).set('Cookie', adminCookie).send({ reference: 'x' }).expect(400);
  });

  test('search, filter, and pagination on both list endpoints', async () => {
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/purchases/orders')
        .set('Cookie', adminCookie)
        .send({ vendorId, orderDate: '2026-09-05', lines: [{ productId, quantity: 1, unitPrice: 100, taxRate: 0 }] });
    }
    const page1 = await request(app).get('/api/purchases/orders?limit=2&page=1').set('Cookie', adminCookie).expect(200);
    expect(page1.body.purchaseOrders).toHaveLength(2);
    expect(page1.body.pagination.total).toBe(3);
    const filtered = await request(app).get(`/api/purchases/orders?vendorId=${vendorId}`).set('Cookie', adminCookie).expect(200);
    expect(filtered.body.purchaseOrders.length).toBe(3);
    const noMatch = await request(app).get('/api/purchases/orders?search=nothing-matches').set('Cookie', adminCookie).expect(200);
    expect(noMatch.body.purchaseOrders).toHaveLength(0);
  });

  test('unauthenticated and CONTACT role are rejected', async () => {
    await request(app).get('/api/purchases/orders').expect(401);
    await request(app).get('/api/purchases/bills').expect(401);
    const contactCookie = await login(app, 'contact');
    await request(app).get('/api/purchases/orders').set('Cookie', contactCookie).expect(403);
    await request(app).get('/api/purchases/bills').set('Cookie', contactCookie).expect(403);
  });
});
