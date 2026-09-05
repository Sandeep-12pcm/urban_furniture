const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { login } = require('./helpers/authHelpers');

describe('Business analytics API', () => {
  let pool; let app; let adminCookie; let contactCookie;
  beforeAll(() => { pool = createTestPool(); app = createApp(pool); });
  afterAll(async () => pool.end());
  beforeEach(async () => { await resetDatabase(pool); await createUser(pool, 'ADMIN', { loginId: 'admin' }); await createUser(pool, 'CONTACT', { loginId: 'contact' }); adminCookie = await login(app, 'admin'); contactCookie = await login(app, 'contact'); });
  test('returns real, safe empty analytics and rejects CONTACT users', async () => {
    const dashboard = await request(app).get('/api/analytics/dashboard?startDate=2026-01-01&endDate=2026-12-31').set('Cookie', adminCookie).expect(200);
    expect(dashboard.body.kpis).toMatchObject({ totalRevenue: '0.00', totalExpenses: '0.00', netProfit: '0.00', inventoryValue: '0.00' });
    expect(dashboard.body.inventory.alerts).toEqual([]);
    const [receivables, payables, cashFlow, trends] = await Promise.all([
      request(app).get('/api/analytics/receivables').set('Cookie', adminCookie).expect(200),
      request(app).get('/api/analytics/payables').set('Cookie', adminCookie).expect(200),
      request(app).get('/api/analytics/cash-flow?startDate=2026-01-01&endDate=2026-12-31').set('Cookie', adminCookie).expect(200),
      request(app).get('/api/analytics/trends?startDate=2026-01-01&endDate=2026-12-31').set('Cookie', adminCookie).expect(200),
    ]);
    expect(receivables.body).toMatchObject({ outstanding: '0', outstandingCount: 0, customers: [] });
    expect(payables.body).toMatchObject({ outstanding: '0', outstandingCount: 0, vendors: [] });
    expect(cashFlow.body).toMatchObject({ inflows: '0.00', outflows: '0.00', netCashFlow: '0.00', trend: [] });
    expect(trends.body).toMatchObject({ trend: [] });
    await request(app).get('/api/analytics/dashboard').set('Cookie', contactCookie).expect(403);
    await request(app).get('/api/analytics/receivables').set('Cookie', contactCookie).expect(403);
    await request(app).get('/api/analytics/sales').expect(401);
  });
});
