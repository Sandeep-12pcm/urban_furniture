const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { login } = require('./helpers/authHelpers');

describe('Budget API', () => {
  let pool;
  let app;
  let adminCookie;
  let adminId;
  let analyticAccountId;

  beforeAll(() => {
    pool = createTestPool();
    app = createApp(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await resetDatabase(pool);
    const admin = await createUser(pool, 'ADMIN', { loginId: 'admin' });
    adminId = admin.id;
    await createUser(pool, 'CONTACT', { loginId: 'contact', isActive: false });
    adminCookie = await login(app, 'admin');

    const analytic = await request(app).post('/api/analytic-accounts').set('Cookie', adminCookie).send({ name: 'Marketing', type: 'EXPENSE' });
    analyticAccountId = analytic.body.analyticAccount.id;
  });

  function validBudget(overrides = {}) {
    return {
      name: 'Q1 Marketing Budget',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      plannedAmount: 100000,
      analyticAccountId,
      responsibleUserId: adminId,
      ...overrides,
    };
  }

  test('creates a budget', async () => {
    const created = await request(app).post('/api/budgets').set('Cookie', adminCookie).send(validBudget()).expect(201);
    expect(created.body.budget.analyticAccountName).toBe('Marketing');
    expect(created.body.budget.responsibleUserLoginId).toBe('admin');
  });

  test('rejects end date before start date', async () => {
    await request(app)
      .post('/api/budgets')
      .set('Cookie', adminCookie)
      .send(validBudget({ periodStart: '2026-03-01', periodEnd: '2026-01-01' }))
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Budget end date cannot be before start date.'));
  });

  test('rejects a negative planned amount', async () => {
    await request(app)
      .post('/api/budgets')
      .set('Cookie', adminCookie)
      .send(validBudget({ plannedAmount: -500 }))
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Planned amount must be a valid amount and cannot be negative.'));
  });

  test('rejects an unknown analytic account', async () => {
    await request(app)
      .post('/api/budgets')
      .set('Cookie', adminCookie)
      .send(validBudget({ analyticAccountId: '00000000-0000-0000-0000-000000000000' }))
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Analytic account not found.'));
  });

  test('rejects an inactive or unknown responsible user', async () => {
    const contactUser = await pool.query("SELECT id FROM users WHERE login_id = 'contact'");

    await request(app)
      .post('/api/budgets')
      .set('Cookie', adminCookie)
      .send(validBudget({ responsibleUserId: contactUser.rows[0].id }))
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Responsible person must be an active user.'));

    await request(app)
      .post('/api/budgets')
      .set('Cookie', adminCookie)
      .send(validBudget({ responsibleUserId: '00000000-0000-0000-0000-000000000000' }))
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Responsible person not found.'));
  });

  test('archive and restore a budget (admin only)', async () => {
    await createUser(pool, 'ACCOUNTANT', { loginId: 'accountant' });
    const accountantCookie = await login(app, 'accountant');

    const created = await request(app).post('/api/budgets').set('Cookie', adminCookie).send(validBudget()).expect(201);

    await request(app).post(`/api/budgets/${created.body.budget.id}/archive`).set('Cookie', accountantCookie).expect(403);
    await request(app).post(`/api/budgets/${created.body.budget.id}/archive`).set('Cookie', adminCookie).expect(200);
    await request(app).post(`/api/budgets/${created.body.budget.id}/restore`).set('Cookie', adminCookie).expect(200);
  });
});
