const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { login } = require('./helpers/authHelpers');

describe('Chart of Accounts API', () => {
  let pool;
  let app;
  let adminCookie;
  let accountantCookie;

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
    accountantCookie = await login(app, 'accountant');
  });

  test('creates a top-level account and rejects a duplicate account code', async () => {
    await request(app)
      .post('/api/accounts')
      .set('Cookie', adminCookie)
      .send({ accountCode: '1001', accountName: 'Cash', type: 'ASSET' })
      .expect(201);

    await request(app)
      .post('/api/accounts')
      .set('Cookie', accountantCookie)
      .send({ accountCode: '1001', accountName: 'Cash Again', type: 'ASSET' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Account code already exists.'));
  });

  test('supports a parent-child hierarchy', async () => {
    const parent = await request(app)
      .post('/api/accounts')
      .set('Cookie', adminCookie)
      .send({ accountCode: '1000', accountName: 'Assets', type: 'ASSET' })
      .expect(201);

    const child = await request(app)
      .post('/api/accounts')
      .set('Cookie', adminCookie)
      .send({ accountCode: '1002', accountName: 'Bank', type: 'ASSET', parentAccountId: parent.body.account.id })
      .expect(201);

    expect(child.body.account.parentAccountId).toBe(parent.body.account.id);

    await request(app)
      .post('/api/accounts')
      .set('Cookie', adminCookie)
      .send({ accountCode: '1099', accountName: 'Ghost', type: 'ASSET', parentAccountId: '00000000-0000-0000-0000-000000000000' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Parent account not found.'));
  });

  test('rejects an invalid account type', async () => {
    await request(app)
      .post('/api/accounts')
      .set('Cookie', adminCookie)
      .send({ accountCode: '9999', accountName: 'Mystery', type: 'UNKNOWN' })
      .expect(400);
  });

  test('cannot archive an account that is in use by a child account or a journal', async () => {
    const parent = await request(app)
      .post('/api/accounts')
      .set('Cookie', adminCookie)
      .send({ accountCode: '2000', accountName: 'Liabilities', type: 'LIABILITY' });

    await request(app)
      .post('/api/accounts')
      .set('Cookie', adminCookie)
      .send({ accountCode: '2001', accountName: 'Creditors', type: 'LIABILITY', parentAccountId: parent.body.account.id });

    await request(app)
      .post(`/api/accounts/${parent.body.account.id}/archive`)
      .set('Cookie', adminCookie)
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Account cannot be archived because it is currently in use.'));

    const cash = await request(app)
      .post('/api/accounts')
      .set('Cookie', adminCookie)
      .send({ accountCode: '1001', accountName: 'Cash', type: 'ASSET' });

    await request(app)
      .post('/api/journals')
      .set('Cookie', adminCookie)
      .send({ name: 'Cash Journal', type: 'CASH', defaultAccountId: cash.body.account.id });

    await request(app)
      .post(`/api/accounts/${cash.body.account.id}/archive`)
      .set('Cookie', adminCookie)
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Account cannot be archived because it is currently in use.'));
  });

  test('accountant can create and update but not archive', async () => {
    const account = await request(app)
      .post('/api/accounts')
      .set('Cookie', accountantCookie)
      .send({ accountCode: '4001', accountName: 'Sales Income', type: 'INCOME' })
      .expect(201);

    await request(app)
      .patch(`/api/accounts/${account.body.account.id}`)
      .set('Cookie', accountantCookie)
      .send({ description: 'Revenue from furniture sales' })
      .expect(200);

    await request(app).post(`/api/accounts/${account.body.account.id}/archive`).set('Cookie', accountantCookie).expect(403);
  });

  test('unauthenticated and contact roles are rejected', async () => {
    await createUser(pool, 'CONTACT', { loginId: 'contact' });
    const contactCookie = await login(app, 'contact');

    await request(app).get('/api/accounts').expect(401);
    await request(app).get('/api/accounts').set('Cookie', contactCookie).expect(403);
  });
});
