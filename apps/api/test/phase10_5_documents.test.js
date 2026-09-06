const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { seedAccountingFixtures, createContact, createProduct } = require('./helpers/fixtures');
const { login } = require('./helpers/authHelpers');

describe('Phase 10.5: Customer & Vendor Experience + Business Documents Completion', () => {
  let pool;
  let app;
  let adminCookie;
  let fixtures;
  let customerAId, customerBId;
  let vendorAId, vendorBId;
  let customerACookie, customerBCookie;
  let vendorACookie, vendorBCookie;
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
    adminCookie = await login(app, 'admin');
    fixtures = await seedAccountingFixtures(pool);

    // Create Contacts
    customerAId = await createContact(pool, 'CUSTOMER', { name: 'Customer Alpha' });
    customerBId = await createContact(pool, 'CUSTOMER', { name: 'Customer Beta' });
    vendorAId = await createContact(pool, 'VENDOR', { name: 'Vendor Alpha' });
    vendorBId = await createContact(pool, 'VENDOR', { name: 'Vendor Beta' });

    // Create Portal Users
    await createUser(pool, 'CONTACT', { loginId: 'customer_a', contactId: customerAId, accountType: 'CUSTOMER' });
    await createUser(pool, 'CONTACT', { loginId: 'customer_b', contactId: customerBId, accountType: 'CUSTOMER' });
    await createUser(pool, 'CONTACT', { loginId: 'vendor_a', contactId: vendorAId, accountType: 'VENDOR' });
    await createUser(pool, 'CONTACT', { loginId: 'vendor_b', contactId: vendorBId, accountType: 'VENDOR' });

    customerACookie = await login(app, 'customer_a');
    customerBCookie = await login(app, 'customer_b');
    vendorACookie = await login(app, 'vendor_a');
    vendorBCookie = await login(app, 'vendor_b');

    // Create Product and Opening Stock
    productId = await createProduct(pool, fixtures.categoryId, {
      name: 'Ergonomic Desk',
      salesPrice: 10000,
      purchasePrice: 6000,
    });
    await request(app)
      .post('/api/inventory/adjustments')
      .set('Cookie', adminCookie)
      .send({ productId, direction: 'IN', quantity: 100, reason: 'Initial test stock' })
      .expect(201);
  });

  describe('1. Customer Portal & Invoices Experience', () => {
    let invoiceAId, invoiceBId;
    let paymentAId, paymentBId;

    beforeEach(async () => {
      // Create and post Invoice for Customer A (10 units @ 10,000 + 18% tax = 118,000)
      const soA = await request(app)
        .post('/api/sales/orders')
        .set('Cookie', adminCookie)
        .send({
          customerId: customerAId,
          orderDate: '2026-09-01',
          items: [{ productId, quantity: 5, unitPrice: 10000, taxRate: 18 }],
        })
        .expect(201);

      await request(app)
        .post(`/api/sales/orders/${soA.body.salesOrder.id}/confirm`)
        .set('Cookie', adminCookie)
        .expect(200);

      const invA = await request(app)
        .post('/api/sales/invoices')
        .set('Cookie', adminCookie)
        .send({
          customerId: customerAId,
          salesOrderId: soA.body.salesOrder.id,
          invoiceDate: '2026-09-01',
          dueDate: '2026-09-15',
          items: [{ productId, quantity: 5, unitPrice: 10000, taxRate: 18 }],
        })
        .expect(201);
      invoiceAId = invA.body.customerInvoice.id;

      await request(app)
        .post(`/api/sales/invoices/${invoiceAId}/post`)
        .set('Cookie', adminCookie)
        .expect(200);

      // Record partial payment for Customer A (20,000)
      const payA = await request(app)
        .post(`/api/sales/invoices/${invoiceAId}/payments`)
        .set('Cookie', adminCookie)
        .send({ amount: 20000, paymentDate: '2026-09-02', method: 'BANK', reference: 'TXN-A-001' })
        .expect(201);
      paymentAId = payA.body.payment.id;

      // Create and post Invoice for Customer B
      const invB = await request(app)
        .post('/api/sales/invoices')
        .set('Cookie', adminCookie)
        .send({
          customerId: customerBId,
          invoiceDate: '2026-09-01',
          dueDate: '2026-09-20',
          items: [{ productId, quantity: 2, unitPrice: 10000, taxRate: 18 }],
        })
        .expect(201);
      invoiceBId = invB.body.customerInvoice.id;

      await request(app)
        .post(`/api/sales/invoices/${invoiceBId}/post`)
        .set('Cookie', adminCookie)
        .expect(200);

      const payB = await request(app)
        .post(`/api/sales/invoices/${invoiceBId}/payments`)
        .set('Cookie', adminCookie)
        .send({ amount: 10000, paymentDate: '2026-09-03', method: 'CASH', reference: 'CASH-B-001' })
        .expect(201);
      paymentBId = payB.body.payment.id;
    });

    test('Customer A can view their portal summary and KPIs', async () => {
      const res = await request(app)
        .get('/api/portal/summary')
        .set('Cookie', customerACookie)
        .expect(200);

      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.accountType).toBe('CUSTOMER');
      expect(res.body.summary.kpis.totalInvoices).toBe(1);
      expect(res.body.summary.kpis.partiallyPaidInvoices).toBe(1);
      // Total 59000, paid 20000, outstanding 39000
      expect(res.body.summary.kpis.outstandingAmount).toBe('39000.00');
      expect(res.body.summary.recentInvoices).toHaveLength(1);
      expect(res.body.summary.recentInvoices[0].id).toBe(invoiceAId);
      expect(res.body.summary.recentPayments).toHaveLength(1);
      expect(res.body.summary.recentPayments[0].id).toBe(paymentAId);
    });

    test('Customer A lists only their own invoices', async () => {
      const res = await request(app)
        .get('/api/sales/invoices')
        .set('Cookie', customerACookie)
        .expect(200);

      expect(res.body.customerInvoices).toHaveLength(1);
      expect(res.body.customerInvoices[0].id).toBe(invoiceAId);
      expect(res.body.customerInvoices[0].customerName).toBe('Customer Alpha');
    });

    test('Customer A can view their own invoice details', async () => {
      const res = await request(app)
        .get(`/api/sales/invoices/${invoiceAId}`)
        .set('Cookie', customerACookie)
        .expect(200);

      expect(res.body.customerInvoice.id).toBe(invoiceAId);
      expect(res.body.customerInvoice.paymentStatus).toBe('PARTIALLY_PAID');
      expect(res.body.customerInvoice.totalAmount).toBe('59000.00');
    });

    test('Customer A can download their own invoice PDF with correct headers and binary content', async () => {
      const res = await request(app)
        .get(`/api/sales/invoices/${invoiceAId}/pdf`)
        .set('Cookie', customerACookie)
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="INV-.*\.pdf"/);
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.slice(0, 4).toString('ascii')).toBe('%PDF');
    });

    test('Customer A can view only their own payments and download receipt PDF', async () => {
      const listRes = await request(app)
        .get('/api/payments')
        .set('Cookie', customerACookie)
        .expect(200);

      expect(listRes.body.payments).toHaveLength(1);
      expect(listRes.body.payments[0].id).toBe(paymentAId);

      const receiptRes = await request(app)
        .get(`/api/payments/${paymentAId}/receipt/pdf`)
        .set('Cookie', customerACookie)
        .expect(200);

      expect(receiptRes.headers['content-type']).toContain('application/pdf');
      expect(receiptRes.headers['content-disposition']).toMatch(/attachment; filename="RECEIPT-.*\.pdf"/);
      expect(receiptRes.body).toBeInstanceOf(Buffer);
      expect(receiptRes.body.slice(0, 4).toString('ascii')).toBe('%PDF');
    });

    test('CRITICAL IDOR: Customer A cannot access Customer B invoice or PDF', async () => {
      // Direct invoice detail access
      await request(app)
        .get(`/api/sales/invoices/${invoiceBId}`)
        .set('Cookie', customerACookie)
        .expect(403);

      // Direct PDF download access
      await request(app)
        .get(`/api/sales/invoices/${invoiceBId}/pdf`)
        .set('Cookie', customerACookie)
        .expect(403);

      // Direct outstanding balance access
      await request(app)
        .get(`/api/sales/invoices/${invoiceBId}/outstanding`)
        .set('Cookie', customerACookie)
        .expect(403);

      // Query param override attempt in list (supplying customerBId should be ignored)
      const listRes = await request(app)
        .get(`/api/sales/invoices?customerId=${customerBId}`)
        .set('Cookie', customerACookie)
        .expect(200);

      expect(listRes.body.customerInvoices).toHaveLength(1);
      expect(listRes.body.customerInvoices[0].id).toBe(invoiceAId);
    });

    test('CRITICAL IDOR: Customer A cannot access Customer B payment or receipt PDF', async () => {
      // Direct payment detail access
      await request(app)
        .get(`/api/payments/${paymentBId}`)
        .set('Cookie', customerACookie)
        .expect(403);

      // Direct payment receipt PDF download access
      await request(app)
        .get(`/api/payments/${paymentBId}/receipt/pdf`)
        .set('Cookie', customerACookie)
        .expect(403);

      // Query param override attempt in list
      const listRes = await request(app)
        .get(`/api/payments?contactId=${customerBId}`)
        .set('Cookie', customerACookie)
        .expect(200);

      expect(listRes.body.payments).toHaveLength(1);
      expect(listRes.body.payments[0].id).toBe(paymentAId);
    });
  });

  describe('2. Vendor Portal & Bills Experience', () => {
    let billAId, billBId;
    let paymentAId, paymentBId;

    beforeEach(async () => {
      // Create and post Bill for Vendor A (4 units @ 6,000 + 18% tax = 28,320)
      const poA = await request(app)
        .post('/api/purchases/orders')
        .set('Cookie', adminCookie)
        .send({
          vendorId: vendorAId,
          orderDate: '2026-09-01',
          lines: [{ productId, quantity: 4, unitPrice: 6000, taxRate: 18 }],
        })
        .expect(201);

      await request(app)
        .post(`/api/purchases/orders/${poA.body.purchaseOrder.id}/confirm`)
        .set('Cookie', adminCookie)
        .expect(200);

      const billA = await request(app)
        .post('/api/purchases/bills')
        .set('Cookie', adminCookie)
        .send({
          vendorId: vendorAId,
          purchaseOrderId: poA.body.purchaseOrder.id,
          vendorInvoiceNumber: 'VEND-A-INV-99',
          invoiceDate: '2026-09-01',
          dueDate: '2026-09-18',
          lines: [{ productId, quantity: 4, unitPrice: 6000, taxRate: 18 }],
        })
        .expect(201);
      billAId = billA.body.vendorBill.id;

      await request(app)
        .post(`/api/purchases/bills/${billAId}/post`)
        .set('Cookie', adminCookie)
        .expect(200);

      // Record partial payment to Vendor A (10,000)
      const payA = await request(app)
        .post(`/api/purchases/bills/${billAId}/payments`)
        .set('Cookie', adminCookie)
        .send({ amount: 10000, paymentDate: '2026-09-03', method: 'BANK', reference: 'BANK-VEND-A' })
        .expect(201);
      paymentAId = payA.body.payment.id;

      // Create and post Bill for Vendor B
      const billB = await request(app)
        .post('/api/purchases/bills')
        .set('Cookie', adminCookie)
        .send({
          vendorId: vendorBId,
          vendorInvoiceNumber: 'VEND-B-INV-77',
          invoiceDate: '2026-09-01',
          dueDate: '2026-09-25',
          lines: [{ productId, quantity: 2, unitPrice: 6000, taxRate: 18 }],
        })
        .expect(201);
      billBId = billB.body.vendorBill.id;

      await request(app)
        .post(`/api/purchases/bills/${billBId}/post`)
        .set('Cookie', adminCookie)
        .expect(200);

      const payB = await request(app)
        .post(`/api/purchases/bills/${billBId}/payments`)
        .set('Cookie', adminCookie)
        .send({ amount: 5000, paymentDate: '2026-09-04', method: 'CASH', reference: 'CASH-VEND-B' })
        .expect(201);
      paymentBId = payB.body.payment.id;
    });

    test('Vendor A can view their portal summary and KPIs', async () => {
      const res = await request(app)
        .get('/api/portal/summary')
        .set('Cookie', vendorACookie)
        .expect(200);

      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.accountType).toBe('VENDOR');
      expect(res.body.summary.kpis.totalBills).toBe(1);
      expect(res.body.summary.kpis.partiallyPaidBills).toBe(1);
      // Total 28320, paid 10000, outstanding 18320
      expect(res.body.summary.kpis.outstandingPayable).toBe('18320.00');
      expect(res.body.summary.recentBills).toHaveLength(1);
      expect(res.body.summary.recentBills[0].id).toBe(billAId);
      expect(res.body.summary.recentPayments).toHaveLength(1);
      expect(res.body.summary.recentPayments[0].id).toBe(paymentAId);
    });

    test('Vendor A lists only their own bills', async () => {
      const res = await request(app)
        .get('/api/purchases/bills')
        .set('Cookie', vendorACookie)
        .expect(200);

      expect(res.body.vendorBills).toHaveLength(1);
      expect(res.body.vendorBills[0].id).toBe(billAId);
      expect(res.body.vendorBills[0].vendorName).toBe('Vendor Alpha');
    });

    test('Vendor A can view their own bill details', async () => {
      const res = await request(app)
        .get(`/api/purchases/bills/${billAId}`)
        .set('Cookie', vendorACookie)
        .expect(200);

      expect(res.body.vendorBill.id).toBe(billAId);
      expect(res.body.vendorBill.paymentStatus).toBe('PARTIALLY_PAID');
      expect(res.body.vendorBill.totalAmount).toBe('28320.00');
    });

    test('Vendor A can download their own bill PDF with correct headers and binary content', async () => {
      const res = await request(app)
        .get(`/api/purchases/bills/${billAId}/pdf`)
        .set('Cookie', vendorACookie)
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="VB-.*\.pdf"/);
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.slice(0, 4).toString('ascii')).toBe('%PDF');
    });

    test('Vendor A can view only their own payments and download receipt PDF', async () => {
      const listRes = await request(app)
        .get('/api/payments')
        .set('Cookie', vendorACookie)
        .expect(200);

      expect(listRes.body.payments).toHaveLength(1);
      expect(listRes.body.payments[0].id).toBe(paymentAId);

      const receiptRes = await request(app)
        .get(`/api/payments/${paymentAId}/receipt/pdf`)
        .set('Cookie', vendorACookie)
        .expect(200);

      expect(receiptRes.headers['content-type']).toContain('application/pdf');
      expect(receiptRes.headers['content-disposition']).toMatch(/attachment; filename="RECEIPT-.*\.pdf"/);
      expect(receiptRes.body).toBeInstanceOf(Buffer);
      expect(receiptRes.body.slice(0, 4).toString('ascii')).toBe('%PDF');
    });

    test('CRITICAL IDOR: Vendor A cannot access Vendor B bill or PDF', async () => {
      // Direct bill detail access
      await request(app)
        .get(`/api/purchases/bills/${billBId}`)
        .set('Cookie', vendorACookie)
        .expect(403);

      // Direct PDF download access
      await request(app)
        .get(`/api/purchases/bills/${billBId}/pdf`)
        .set('Cookie', vendorACookie)
        .expect(403);

      // Direct outstanding payable access
      await request(app)
        .get(`/api/purchases/bills/${billBId}/outstanding`)
        .set('Cookie', vendorACookie)
        .expect(403);

      // Query param override attempt in list
      const listRes = await request(app)
        .get(`/api/purchases/bills?vendorId=${vendorBId}`)
        .set('Cookie', vendorACookie)
        .expect(200);

      expect(listRes.body.vendorBills).toHaveLength(1);
      expect(listRes.body.vendorBills[0].id).toBe(billAId);
    });

    test('CRITICAL IDOR: Vendor A cannot access Vendor B payment or receipt PDF', async () => {
      // Direct payment detail access
      await request(app)
        .get(`/api/payments/${paymentBId}`)
        .set('Cookie', vendorACookie)
        .expect(403);

      // Direct payment receipt PDF download access
      await request(app)
        .get(`/api/payments/${paymentBId}/receipt/pdf`)
        .set('Cookie', vendorACookie)
        .expect(403);

      // Query param override attempt in list
      const listRes = await request(app)
        .get(`/api/payments?contactId=${vendorBId}`)
        .set('Cookie', vendorACookie)
        .expect(200);

      expect(listRes.body.payments).toHaveLength(1);
      expect(listRes.body.payments[0].id).toBe(paymentAId);
    });
  });

  describe('3. Document Immutability & Accounting Reconciliation', () => {
    test('Generating PDFs does not mutate document or accounting records', async () => {
      const so = await request(app)
        .post('/api/sales/orders')
        .set('Cookie', adminCookie)
        .send({
          customerId: customerAId,
          orderDate: '2026-09-01',
          items: [{ productId, quantity: 1, unitPrice: 10000, taxRate: 18 }],
        })
        .expect(201);

      await request(app)
        .post(`/api/sales/orders/${so.body.salesOrder.id}/confirm`)
        .set('Cookie', adminCookie)
        .expect(200);

      const inv = await request(app)
        .post('/api/sales/invoices')
        .set('Cookie', adminCookie)
        .send({
          customerId: customerAId,
          salesOrderId: so.body.salesOrder.id,
          invoiceDate: '2026-09-01',
          dueDate: '2026-09-15',
          items: [{ productId, quantity: 1, unitPrice: 10000, taxRate: 18 }],
        })
        .expect(201);
      const invoiceId = inv.body.customerInvoice.id;

      await request(app)
        .post(`/api/sales/invoices/${invoiceId}/post`)
        .set('Cookie', adminCookie)
        .expect(200);

      const beforeDoc = await request(app)
        .get(`/api/sales/invoices/${invoiceId}`)
        .set('Cookie', adminCookie)
        .expect(200);

      // Download PDF multiple times
      await request(app)
        .get(`/api/sales/invoices/${invoiceId}/pdf`)
        .set('Cookie', customerACookie)
        .expect(200);

      await request(app)
        .get(`/api/sales/invoices/${invoiceId}/pdf`)
        .set('Cookie', adminCookie)
        .expect(200);

      const afterDoc = await request(app)
        .get(`/api/sales/invoices/${invoiceId}`)
        .set('Cookie', adminCookie)
        .expect(200);

      // Ensure zero mutation
      expect(afterDoc.body.customerInvoice.status).toBe(beforeDoc.body.customerInvoice.status);
      expect(afterDoc.body.customerInvoice.totalAmount).toBe(beforeDoc.body.customerInvoice.totalAmount);
      expect(afterDoc.body.customerInvoice.accountingEntryId).toBe(beforeDoc.body.customerInvoice.accountingEntryId);
      expect(afterDoc.body.customerInvoice.updatedAt).toBe(beforeDoc.body.customerInvoice.updatedAt);
    });
  });

  describe('4. Unauthenticated Access Protection', () => {
    test('Unauthenticated callers cannot access PDF or portal endpoints', async () => {
      await request(app).get('/api/portal/summary').expect(401);
      await request(app).get('/api/sales/invoices/11111111-1111-1111-1111-111111111111/pdf').expect(401);
      await request(app).get('/api/purchases/bills/11111111-1111-1111-1111-111111111111/pdf').expect(401);
      await request(app).get('/api/payments/11111111-1111-1111-1111-111111111111/receipt/pdf').expect(401);
    });
  });
});
