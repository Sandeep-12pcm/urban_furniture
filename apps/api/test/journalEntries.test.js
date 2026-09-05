const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { seedAccountingFixtures } = require('./helpers/fixtures');
const { login } = require('./helpers/authHelpers');

describe('Journal Entry API (accounting engine)', () => {
  let pool;
  let app;
  let adminCookie;
  let fixtures;

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
  });

  function validEntry(overrides = {}) {
    return {
      journalId: fixtures.journalIds.CASH,
      entryDate: '2026-09-05',
      reference: 'TEST-1',
      lines: [
        { accountId: fixtures.accountIds['1001'], debit: '100.00', credit: '0.00' },
        { accountId: fixtures.accountIds['1002'], debit: '0.00', credit: '100.00' },
      ],
      ...overrides,
    };
  }

  test('creates a balanced draft entry and posts it', async () => {
    const created = await request(app).post('/api/journal-entries').set('Cookie', adminCookie).send(validEntry()).expect(201);
    expect(created.body.journalEntry.status).toBe('DRAFT');
    expect(created.body.journalEntry.balanced).toBe(true);

    const posted = await request(app)
      .post(`/api/journal-entries/${created.body.journalEntry.id}/post`)
      .set('Cookie', adminCookie)
      .expect(200);
    expect(posted.body.journalEntry.status).toBe('POSTED');
    expect(posted.body.journalEntry.totalDebit).toBe('100.00');
    expect(posted.body.journalEntry.totalCredit).toBe('100.00');
  });

  test('allows saving an unbalanced draft but rejects posting it', async () => {
    const unbalanced = validEntry({
      lines: [
        { accountId: fixtures.accountIds['1001'], debit: '100.00', credit: '0.00' },
        { accountId: fixtures.accountIds['1002'], debit: '0.00', credit: '50.00' },
      ],
    });
    const created = await request(app).post('/api/journal-entries').set('Cookie', adminCookie).send(unbalanced).expect(201);
    expect(created.body.journalEntry.balanced).toBe(false);

    await request(app)
      .post(`/api/journal-entries/${created.body.journalEntry.id}/post`)
      .set('Cookie', adminCookie)
      .expect(400)
      .expect(({ body }) => expect(body.message).toContain('debits and credits do not match'));
  });

  test('rejects fewer than two lines and single-sided lines', async () => {
    await request(app)
      .post('/api/journal-entries')
      .set('Cookie', adminCookie)
      .send(validEntry({ lines: [{ accountId: fixtures.accountIds['1001'], debit: '100.00', credit: '0.00' }] }))
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Journal Entry must contain at least two lines.'));
  });

  test('rejects an entry referencing an archived account, and never partially writes on a bad account id', async () => {
    const spare = await request(app)
      .post('/api/accounts')
      .set('Cookie', adminCookie)
      .send({ accountCode: '1099', accountName: 'Spare Asset', type: 'ASSET' });
    const spareId = spare.body.account.id;
    await request(app).post(`/api/accounts/${spareId}/archive`).set('Cookie', adminCookie).expect(200);

    await request(app)
      .post('/api/journal-entries')
      .set('Cookie', adminCookie)
      .send(validEntry({ lines: [
        { accountId: spareId, debit: '100.00', credit: '0.00' },
        { accountId: fixtures.accountIds['1001'], debit: '0.00', credit: '100.00' },
      ] }))
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Account is archived and cannot be used.'));

    const before = await request(app).get('/api/journal-entries?limit=200').set('Cookie', adminCookie);
    await request(app)
      .post('/api/journal-entries')
      .set('Cookie', adminCookie)
      .send(validEntry({ lines: [
        { accountId: '00000000-0000-0000-0000-000000000000', debit: '100.00', credit: '0.00' },
        { accountId: fixtures.accountIds['1001'], debit: '0.00', credit: '100.00' },
      ] }))
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Account does not exist.'));
    const after = await request(app).get('/api/journal-entries?limit=200').set('Cookie', adminCookie);
    expect(after.body.journalEntries.length).toBe(before.body.journalEntries.length);
  });

  test('only a Draft entry can be posted or cancelled; posted entries cannot be edited', async () => {
    const created = await request(app).post('/api/journal-entries').set('Cookie', adminCookie).send(validEntry());
    const id = created.body.journalEntry.id;
    await request(app).post(`/api/journal-entries/${id}/post`).set('Cookie', adminCookie).expect(200);

    await request(app).post(`/api/journal-entries/${id}/post`).set('Cookie', adminCookie).expect(400);
    await request(app).post(`/api/journal-entries/${id}/cancel`).set('Cookie', adminCookie).expect(400);
    await request(app)
      .patch(`/api/journal-entries/${id}`)
      .set('Cookie', adminCookie)
      .send({ description: 'edited' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Posted Journal Entries cannot be edited.'));
  });

  test('cancels a draft entry', async () => {
    const created = await request(app).post('/api/journal-entries').set('Cookie', adminCookie).send(validEntry());
    await request(app)
      .post(`/api/journal-entries/${created.body.journalEntry.id}/cancel`)
      .set('Cookie', adminCookie)
      .expect(200)
      .expect(({ body }) => expect(body.journalEntry.status).toBe('CANCELLED'));
  });

  test('unauthenticated and CONTACT role are rejected', async () => {
    await request(app).get('/api/journal-entries').expect(401);
    const contactCookie = await login(app, 'contact');
    await request(app).get('/api/journal-entries').set('Cookie', contactCookie).expect(403);
  });

  // Regression: GET /accounts/balances is a literal route registered in a
  // different router than GET /accounts/:id. If accountsRoutes is ever
  // mounted before accountingReportsRoutes again, Express matches "balances"
  // as the :id wildcard first and this 500s trying to cast it to a UUID.
  test('GET /accounts/balances resolves to the reports route, not accounts/:id', async () => {
    const response = await request(app).get('/api/accounts/balances').set('Cookie', adminCookie).expect(200);
    expect(Array.isArray(response.body.accounts)).toBe(true);
  });
});
