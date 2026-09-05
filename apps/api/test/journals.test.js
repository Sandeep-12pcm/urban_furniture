const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { login } = require('./helpers/authHelpers');

describe('Journal Master API', () => {
  let pool;
  let app;
  let adminCookie;
  let salesAccountId;
  let bankAccountId;

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

    const sales = await request(app).post('/api/accounts').set('Cookie', adminCookie).send({ accountCode: '4001', accountName: 'Sales Income', type: 'INCOME' });
    salesAccountId = sales.body.account.id;
    const bank = await request(app).post('/api/accounts').set('Cookie', adminCookie).send({ accountCode: '1002', accountName: 'Bank', type: 'ASSET' });
    bankAccountId = bank.body.account.id;
  });

  test('creates journals for each supported type with a default account', async () => {
    const journal = await request(app)
      .post('/api/journals')
      .set('Cookie', adminCookie)
      .send({ name: 'Sales Journal', type: 'SALES', defaultAccountId: salesAccountId })
      .expect(201);

    expect(journal.body.journal.defaultAccountName).toBe('Sales Income');
  });

  test('rejects a duplicate journal name and an unknown default account', async () => {
    await request(app).post('/api/journals').set('Cookie', adminCookie).send({ name: 'Bank Journal', type: 'BANK', defaultAccountId: bankAccountId }).expect(201);

    await request(app)
      .post('/api/journals')
      .set('Cookie', adminCookie)
      .send({ name: 'Bank Journal', type: 'BANK', defaultAccountId: bankAccountId })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Journal name already exists.'));

    await request(app)
      .post('/api/journals')
      .set('Cookie', adminCookie)
      .send({ name: 'Ghost Journal', type: 'CASH', defaultAccountId: '00000000-0000-0000-0000-000000000000' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Default account not found.'));
  });

  test('rejects an archived default account', async () => {
    await request(app).post(`/api/accounts/${bankAccountId}/archive`).set('Cookie', adminCookie).expect(200);

    await request(app)
      .post('/api/journals')
      .set('Cookie', adminCookie)
      .send({ name: 'Bank Journal', type: 'BANK', defaultAccountId: bankAccountId })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Cannot assign an archived account as the default account.'));
  });

  test('archive and restore a journal', async () => {
    const journal = await request(app)
      .post('/api/journals')
      .set('Cookie', adminCookie)
      .send({ name: 'Purchase Journal', type: 'PURCHASE', defaultAccountId: salesAccountId })
      .expect(201);

    await request(app).post(`/api/journals/${journal.body.journal.id}/archive`).set('Cookie', adminCookie).expect(200);
    await request(app).post(`/api/journals/${journal.body.journal.id}/restore`).set('Cookie', adminCookie).expect(200);
  });

  test('contact role is denied', async () => {
    const contactCookie = await login(app, 'contact');
    await request(app).get('/api/journals').set('Cookie', contactCookie).expect(403);
  });
});
