const request = require('supertest');
const { createApp } = require('../src/app');

const app = createApp();

describe('Urban Furniture Accounting System - Member 1 Test Suite', () => {
  let adminToken;
  let accountantToken;

  beforeAll(async () => {
    // Authenticate Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'admin', password: 'ChangeMe@12345' });
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    adminToken = adminRes.body.token;

    // Authenticate Accountant
    const accRes = await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'accountant', password: 'Accountant@12345' });
    expect(accRes.status).toBe(200);
    expect(accRes.body.success).toBe(true);
    accountantToken = accRes.body.token;
  });

  describe('1. Authentication & RBAC', () => {
    test('POST /api/auth/login - fails with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ loginId: 'admin', password: 'WrongPassword' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/auth/me - succeeds with Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('ADMIN');
    });

    test('GET /api/auth/me - rejects missing token with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('POST /api/auth/logout - succeeds', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });
  });

  describe('2. Contacts API (/api/contacts)', () => {
    let testContactId;

    test('POST /api/contacts - creates contact successfully', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Apex Test Furnishings',
          type: 'VENDOR',
          email: 'test.apex@example.com',
          phone: '+91 98888 77777',
          city: 'Bangalore',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Apex Test Furnishings');
      testContactId = res.body.data.id;
    });

    test('POST /api/contacts - rejects duplicate email with 409', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Apex',
          email: 'test.apex@example.com',
        });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/contacts - lists contacts', async () => {
      const res = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.contacts)).toBe(true);
      expect(res.body.data.contacts.length).toBeGreaterThan(0);
    });

    test('GET /api/contacts/:id - retrieves single contact', async () => {
      const res = await request(app)
        .get(`/api/contacts/${testContactId}`)
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testContactId);
    });

    test('PUT /api/contacts/:id - updates contact', async () => {
      const res = await request(app)
        .put(`/api/contacts/${testContactId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Apex Test Furnishings (Updated)',
          city: 'Hyderabad',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Apex Test Furnishings (Updated)');
      expect(res.body.data.city).toBe('Hyderabad');
    });

    test('DELETE /api/contacts/:id - deletes contact', async () => {
      const res = await request(app)
        .delete(`/api/contacts/${testContactId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('3. Products API (/api/products)', () => {
    let testProductId;

    test('POST /api/products - creates product successfully', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'TEST-PROD-999',
          name: 'Acoustic Wall Panel',
          salesPrice: 4500,
          costPrice: 2200,
          type: 'STORABLE',
          uom: 'SqFt',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('TEST-PROD-999');
      testProductId = res.body.data.id;
    });

    test('POST /api/products - rejects duplicate code with 409', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'TEST-PROD-999',
          name: 'Duplicate Wall Panel',
        });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/products - lists products', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.products.length).toBeGreaterThan(0);
    });

    test('GET /api/products/:id - retrieves product', async () => {
      const res = await request(app)
        .get(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testProductId);
    });

    test('PUT /api/products/:id - updates product', async () => {
      const res = await request(app)
        .put(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          salesPrice: 4800,
        });
      expect(res.status).toBe(200);
      expect(Number(res.body.data.salesPrice)).toBe(4800);
    });

    test('DELETE /api/products/:id - deletes product', async () => {
      const res = await request(app)
        .delete(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('4. Chart of Accounts API (/api/accounts)', () => {
    let testAccountId;

    test('POST /api/accounts - creates account successfully', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: '609876',
          name: 'Showroom Interior Refurbishment',
          type: 'EXPENSE',
          description: 'Periodic remodeling expenses',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('609876');
      testAccountId = res.body.data.id;
    });

    test('POST /api/accounts - rejects duplicate code with 409', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: '609876',
          name: 'Duplicate Refurbishment',
          type: 'EXPENSE',
        });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/accounts - lists chart of accounts', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.accounts.length).toBeGreaterThan(0);
    });

    test('GET /api/accounts/:id - retrieves account', async () => {
      const res = await request(app)
        .get(`/api/accounts/${testAccountId}`)
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testAccountId);
    });

    test('PUT /api/accounts/:id - updates account', async () => {
      const res = await request(app)
        .put(`/api/accounts/${testAccountId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Showroom Interior Refurbishment (Renamed)',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Showroom Interior Refurbishment (Renamed)');
    });

    test('DELETE /api/accounts/:id - rejects non-admin with 403', async () => {
      const res = await request(app)
        .delete(`/api/accounts/${testAccountId}`)
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(403);
    });

    test('DELETE /api/accounts/:id - deletes account with admin', async () => {
      const res = await request(app)
        .delete(`/api/accounts/${testAccountId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('5. Journals API (/api/journals)', () => {
    let testJournalId;

    test('POST /api/journals - creates journal successfully', async () => {
      const res = await request(app)
        .post('/api/journals')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'ADJ',
          name: 'Year-End Adjustments Journal',
          type: 'GENERAL',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('ADJ');
      testJournalId = res.body.data.id;
    });

    test('POST /api/journals - rejects duplicate code with 409', async () => {
      const res = await request(app)
        .post('/api/journals')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'ADJ',
          name: 'Duplicate Adjustments',
          type: 'GENERAL',
        });
      expect(res.status).toBe(409);
    });

    test('GET /api/journals - lists journals', async () => {
      const res = await request(app)
        .get('/api/journals')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.journals.length).toBeGreaterThan(0);
    });

    test('DELETE /api/journals/:id - deletes journal with admin', async () => {
      const res = await request(app)
        .delete(`/api/journals/${testJournalId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('6. Analytic Accounts API (/api/analytic-accounts)', () => {
    let testAnalyticId;

    test('POST /api/analytic-accounts - creates analytic account', async () => {
      const res = await request(app)
        .post('/api/analytic-accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'AN-PUNE',
          name: 'Pune Innovation Studio',
          description: 'R&D and prototype workshop',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe('AN-PUNE');
      testAnalyticId = res.body.data.id;
    });

    test('POST /api/analytic-accounts - duplicate check', async () => {
      const res = await request(app)
        .post('/api/analytic-accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'AN-PUNE',
          name: 'Duplicate Pune',
        });
      expect(res.status).toBe(409);
    });

    test('GET /api/analytic-accounts - lists analytic accounts', async () => {
      const res = await request(app)
        .get('/api/analytic-accounts')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.analyticAccounts.length).toBeGreaterThan(0);
    });

    test('DELETE /api/analytic-accounts/:id - deletes analytic account', async () => {
      const res = await request(app)
        .delete(`/api/analytic-accounts/${testAnalyticId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('7. Budgets API (/api/budgets)', () => {
    let testBudgetId;

    test('POST /api/budgets - rejects invalid date range (dateTo < dateFrom)', async () => {
      const res = await request(app)
        .post('/api/budgets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Date Budget',
          dateFrom: '2026-12-31',
          dateTo: '2026-01-01',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('POST /api/budgets - creates budget with items', async () => {
      const res = await request(app)
        .post('/api/budgets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Q3 FY2026 Expansion Budget',
          dateFrom: '2026-10-01T00:00:00.000Z',
          dateTo: '2026-12-31T23:59:59.000Z',
          description: 'Quarter 3 regional expansion plan',
          items: [
            { plannedAmount: 500000, practicalAmount: 0 },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Q3 FY2026 Expansion Budget');
      expect(res.body.data.items.length).toBe(1);
      testBudgetId = res.body.data.id;
    });

    test('GET /api/budgets - lists budgets', async () => {
      const res = await request(app)
        .get('/api/budgets')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.budgets.length).toBeGreaterThan(0);
    });

    test('GET /api/budgets/:id - retrieves budget with items', async () => {
      const res = await request(app)
        .get(`/api/budgets/${testBudgetId}`)
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
    });

    test('DELETE /api/budgets/:id - deletes budget', async () => {
      const res = await request(app)
        .delete(`/api/budgets/${testBudgetId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
