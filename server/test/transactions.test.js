const request = require('supertest');
const { createApp } = require('../src/app');
const { createBalancedJournalEntry } = require('../src/services/accounting.service');

const app = createApp();

describe('Urban Furniture Accounting System - Member 2 Transaction & Accounting Test Suite', () => {
  let adminToken;
  let vendorId;
  let customerId;
  let productId;

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'admin', password: 'ChangeMe@12345' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // 2. Fetch seeded vendor
    const contactsRes = await request(app)
      .get('/api/contacts?type=VENDOR')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(contactsRes.status).toBe(200);
    const vendors = contactsRes.body.data.contacts || contactsRes.body.data;
    expect(vendors.length).toBeGreaterThan(0);
    vendorId = vendors[0].id;

    // 3. Fetch seeded customer
    const custRes = await request(app)
      .get('/api/contacts?type=CUSTOMER')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(custRes.status).toBe(200);
    const customers = custRes.body.data.contacts || custRes.body.data;
    expect(customers.length).toBeGreaterThan(0);
    customerId = customers[0].id;

    // 4. Fetch seeded product
    const prodRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prodRes.status).toBe(200);
    const products = prodRes.body.data.products || prodRes.body.data;
    expect(products.length).toBeGreaterThan(0);
    productId = products[0].id;
  });

  describe('1. Double-Entry Accounting Core & Validation', () => {
    test('Rejects unbalanced journal entry (Total Debit != Total Credit)', async () => {
      // Fetch BILL journal and Accounts
      const journalsRes = await request(app)
        .get('/api/journals')
        .set('Authorization', `Bearer ${adminToken}`);
      const journals = journalsRes.body.data.journals || journalsRes.body.data;
      const billJournal = journals.find((j) => j.code === 'BILL');

      const accountsRes = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`);
      const accounts = accountsRes.body.data.accounts || accountsRes.body.data;
      const expenseAcc = accounts.find((a) => a.code === '501000');
      const apAcc = accounts.find((a) => a.code === '201000');

      await expect(
        createBalancedJournalEntry(null, {
          journalId: billJournal.id,
          reference: 'TEST-UNBALANCED',
          items: [
            { accountId: expenseAcc.id, debit: 1000, credit: 0 },
            { accountId: apAcc.id, debit: 0, credit: 950 }, // Unbalanced by 50!
          ],
        })
      ).rejects.toThrow(/Unbalanced journal entry rejected/i);
    });

    test('Accepts perfectly balanced journal entry and updates account balance', async () => {
      const journalsRes = await request(app)
        .get('/api/journals')
        .set('Authorization', `Bearer ${adminToken}`);
      const journals = journalsRes.body.data.journals || journalsRes.body.data;
      const billJournal = journals.find((j) => j.code === 'BILL');

      const accountsRes = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`);
      const accounts = accountsRes.body.data.accounts || accountsRes.body.data;
      const expenseAcc = accounts.find((a) => a.code === '501000');
      const apAcc = accounts.find((a) => a.code === '201000');

      const entry = await createBalancedJournalEntry(null, {
        journalId: billJournal.id,
        reference: 'TEST-BALANCED',
        items: [
          { accountId: expenseAcc.id, debit: 1200, credit: 0 },
          { accountId: apAcc.id, debit: 0, credit: 1200 },
        ],
      });

      expect(entry).toBeDefined();
      expect(Number(entry.totalDebit)).toBe(1200);
      expect(Number(entry.totalCredit)).toBe(1200);
      expect(entry.status).toBe('POSTED');
    });
  });

  describe('2. Purchase Order Workflow (PO -> Convert -> Bill)', () => {
    let poId;

    test('POST /api/purchase-orders - creates draft PO with server-calculated totals', async () => {
      const res = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId,
          notes: 'Hackathon lumber order',
          items: [
            {
              productId,
              quantity: 10,
              unitPrice: 500,
              taxRate: 18,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const po = res.body.data;
      poId = po.id;
      expect(po.orderNumber).toMatch(/^PO-/);
      expect(Number(po.untaxedAmount)).toBe(5000);
      expect(Number(po.taxAmount)).toBe(900);
      expect(Number(po.totalAmount)).toBe(5900);
      expect(po.status).toBe('DRAFT');
    });

    test('POST /api/purchase-orders - rejects invalid quantity or negative price', async () => {
      const res = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId,
          items: [
            {
              productId,
              quantity: -2,
              unitPrice: 500,
            },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    test('POST /api/purchase-orders/:id/convert-to-bill - fails if PO is not CONFIRMED', async () => {
      const res = await request(app)
        .post(`/api/purchase-orders/${poId}/convert-to-bill`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/must be in CONFIRMED status/i);
    });

    test('PUT /api/purchase-orders/:id - confirms the PO', async () => {
      const res = await request(app)
        .put(`/api/purchase-orders/${poId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CONFIRMED');
    });

    test('POST /api/purchase-orders/:id/convert-to-bill - converts CONFIRMED PO to Vendor Bill', async () => {
      const res = await request(app)
        .post(`/api/purchase-orders/${poId}/convert-to-bill`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const bill = res.body.data;
      expect(bill.billNumber).toMatch(/^BILL-/);
      expect(bill.purchaseOrderId).toBe(poId);
      expect(Number(bill.totalAmount)).toBe(5900);
      expect(Number(bill.amountDue)).toBe(5900);
      expect(bill.status).toBe('DRAFT');
    });
  });

  describe('3. Vendor Bill Workflow & Bill Payments', () => {
    let billId;

    test('POST /api/vendor-bills - creates a new vendor bill in DRAFT', async () => {
      const res = await request(app)
        .post('/api/vendor-bills')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId,
          reference: 'VB-DIRECT-001',
          items: [
            {
              productId,
              description: 'High grade steel hinges',
              quantity: 20,
              unitPrice: 100,
              taxRate: 18,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const bill = res.body.data;
      billId = bill.id;
      expect(Number(bill.untaxedAmount)).toBe(2000);
      expect(Number(bill.taxAmount)).toBe(360);
      expect(Number(bill.totalAmount)).toBe(2360);
      expect(Number(bill.amountDue)).toBe(2360);
      expect(bill.status).toBe('DRAFT');
    });

    test('POST /api/vendor-bills/:id/payment - fails before bill is POSTED', async () => {
      const res = await request(app)
        .post(`/api/vendor-bills/${billId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 500,
          paymentMethod: 'BANK',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/must be POSTED or PARTIALLY_PAID/i);
    });

    test('POST /api/vendor-bills/:id/post - posts vendor bill and generates double-entry journal entry', async () => {
      const res = await request(app)
        .post(`/api/vendor-bills/${billId}/post`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('POSTED');

      // Verify journal entry exists and is balanced
      const jeRes = await request(app)
        .get(`/api/journal-entries?billId=${billId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(jeRes.status).toBe(200);
      expect(jeRes.body.data.length).toBeGreaterThan(0);
      const je = jeRes.body.data[0];
      expect(Number(je.totalDebit)).toBe(2360);
      expect(Number(je.totalCredit)).toBe(2360);
    });

    test('POST /api/vendor-bills/:id/payment - rejects payment exceeding amount due', async () => {
      const res = await request(app)
        .post(`/api/vendor-bills/${billId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 3000, // 3000 > 2360
          paymentMethod: 'BANK',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot exceed outstanding amount/i);
    });

    test('POST /api/vendor-bills/:id/payment - registers partial payment via BANK', async () => {
      const res = await request(app)
        .post(`/api/vendor-bills/${billId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 1000,
          paymentMethod: 'BANK',
        });

      expect(res.status).toBe(201);
      const { payment, bill } = res.body.data;
      expect(payment.paymentMethod).toBe('BANK');
      expect(payment.paymentType).toBe('OUTBOUND');
      expect(Number(bill.amountDue)).toBe(1360);
      expect(bill.status).toBe('PARTIALLY_PAID');
    });

    test('POST /api/vendor-bills/:id/payment - registers final settlement via CASH', async () => {
      const res = await request(app)
        .post(`/api/vendor-bills/${billId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 1360,
          paymentMethod: 'CASH',
        });

      expect(res.status).toBe(201);
      const { bill } = res.body.data;
      expect(Number(bill.amountDue)).toBe(0);
      expect(bill.status).toBe('PAID');
    });
  });

  describe('4. Sales Order Workflow (SO -> Convert -> Invoice)', () => {
    let soId;

    test('POST /api/sales-orders - creates draft SO with server-side totals', async () => {
      const res = await request(app)
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId,
          notes: 'Customer office executive desks',
          items: [
            {
              productId,
              quantity: 5,
              unitPrice: 1200,
              taxRate: 18,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const so = res.body.data;
      soId = so.id;
      expect(so.orderNumber).toMatch(/^SO-/);
      expect(Number(so.untaxedAmount)).toBe(6000);
      expect(Number(so.taxAmount)).toBe(1080);
      expect(Number(so.totalAmount)).toBe(7080);
      expect(so.status).toBe('DRAFT');
    });

    test('PUT /api/sales-orders/:id - confirms sales order', async () => {
      const res = await request(app)
        .put(`/api/sales-orders/${soId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CONFIRMED');
    });

    test('POST /api/sales-orders/:id/convert-to-invoice - converts confirmed SO to Customer Invoice', async () => {
      const res = await request(app)
        .post(`/api/sales-orders/${soId}/convert-to-invoice`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(201);
      const invoice = res.body.data;
      expect(invoice.invoiceNumber).toMatch(/^INV-/);
      expect(invoice.salesOrderId).toBe(soId);
      expect(Number(invoice.totalAmount)).toBe(7080);
      expect(Number(invoice.amountDue)).toBe(7080);
      expect(invoice.status).toBe('DRAFT');
    });
  });

  describe('5. Customer Invoice Workflow & Receipts', () => {
    let invoiceId;

    test('POST /api/invoices - creates draft invoice directly', async () => {
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId,
          reference: 'INV-DIRECT-001',
          items: [
            {
              productId,
              description: 'Bespoke conference table',
              quantity: 2,
              unitPrice: 2500,
              taxRate: 18,
            },
          ],
        });

      expect(res.status).toBe(201);
      const inv = res.body.data;
      invoiceId = inv.id;
      expect(Number(inv.untaxedAmount)).toBe(5000);
      expect(Number(inv.taxAmount)).toBe(900);
      expect(Number(inv.totalAmount)).toBe(5900);
      expect(Number(inv.amountDue)).toBe(5900);
      expect(inv.amountPaid).toBe(0);
      expect(inv.status).toBe('DRAFT');
    });

    test('POST /api/invoices/:id/post - posts invoice and generates double-entry journal entry', async () => {
      const res = await request(app)
        .post(`/api/invoices/${invoiceId}/post`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('POSTED');

      // Verify journal entry
      const jeRes = await request(app)
        .get(`/api/journal-entries?invoiceId=${invoiceId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(jeRes.status).toBe(200);
      expect(jeRes.body.data.length).toBeGreaterThan(0);
      const je = jeRes.body.data[0];
      expect(Number(je.totalDebit)).toBe(5900);
      expect(Number(je.totalCredit)).toBe(5900);
    });

    test('POST /api/invoices/:id/payment - registers partial customer receipt via BANK', async () => {
      const res = await request(app)
        .post(`/api/invoices/${invoiceId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 3000,
          paymentMethod: 'BANK',
        });

      expect(res.status).toBe(201);
      const { payment, invoice } = res.body.data;
      expect(payment.paymentMethod).toBe('BANK');
      expect(payment.paymentType).toBe('INBOUND');
      expect(Number(invoice.amountDue)).toBe(2900);
      expect(Number(invoice.amountPaid)).toBe(3000);
      expect(invoice.status).toBe('PARTIALLY_PAID');
    });

    test('POST /api/invoices/:id/payment - registers remaining balance via CASH', async () => {
      const res = await request(app)
        .post(`/api/invoices/${invoiceId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 2900,
          paymentMethod: 'CASH',
        });

      expect(res.status).toBe(201);
      const { invoice } = res.body.data;
      expect(Number(invoice.amountDue)).toBe(0);
      expect(Number(invoice.amountPaid)).toBe(5900);
      expect(invoice.status).toBe('PAID');
    });
  });

  describe('6. Direct Payments API & Journal Entries Verification', () => {
    test('GET /api/payments - lists recorded payments with relations', async () => {
      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4); // from the above tests
    });

    test('GET /api/journal-entries - every journal entry in the database is strictly balanced', async () => {
      const res = await request(app)
        .get('/api/journal-entries')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const entries = res.body.data;
      expect(entries.length).toBeGreaterThan(0);

      for (const entry of entries) {
        const debit = Number(entry.totalDebit);
        const credit = Number(entry.totalCredit);
        expect(debit).toBe(credit);
        expect(debit).toBeGreaterThan(0);
      }
    });
  });
});
