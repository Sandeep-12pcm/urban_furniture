const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { login } = require('./helpers/authHelpers');

describe('Analytic Account API', () => {
  let pool;
  let app;
  let adminCookie;

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
  });

  test('creates Income and Expense analytic accounts', async () => {
    await request(app).post('/api/analytic-accounts').set('Cookie', adminCookie).send({ name: 'Marketing', type: 'EXPENSE' }).expect(201);
    await request(app).post('/api/analytic-accounts').set('Cookie', adminCookie).send({ name: 'Furniture Manufacturing', type: 'INCOME' }).expect(201);
  });

  test('rejects a duplicate name and an invalid type', async () => {
    await request(app).post('/api/analytic-accounts').set('Cookie', adminCookie).send({ name: 'Operations', type: 'EXPENSE' }).expect(201);

    await request(app)
      .post('/api/analytic-accounts')
      .set('Cookie', adminCookie)
      .send({ name: 'operations', type: 'INCOME' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Analytic account name already exists.'));

    await request(app)
      .post('/api/analytic-accounts')
      .set('Cookie', adminCookie)
      .send({ name: 'Bad Type', type: 'ASSET' })
      .expect(400);
  });

  test('cannot be archived while used by an active budget', async () => {
    const analytic = await request(app).post('/api/analytic-accounts').set('Cookie', adminCookie).send({ name: 'Office Expenses', type: 'EXPENSE' });

    await request(app)
      .post('/api/budgets')
      .set('Cookie', adminCookie)
      .send({
        name: 'Q1 Office Budget',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        plannedAmount: 50000,
        analyticAccountId: analytic.body.analyticAccount.id,
        responsibleUserId: (await pool.query("SELECT id FROM users WHERE login_id = 'admin'")).rows[0].id,
      })
      .expect(201);

    await request(app)
      .post(`/api/analytic-accounts/${analytic.body.analyticAccount.id}/archive`)
      .set('Cookie', adminCookie)
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Analytic account cannot be archived while it is used by an active budget.'));
  });

  test('contact role is denied', async () => {
    const contactCookie = await login(app, 'contact');
    await request(app).get('/api/analytic-accounts').set('Cookie', contactCookie).expect(403);
  });
});
