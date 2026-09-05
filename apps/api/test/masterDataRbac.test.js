const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { login } = require('./helpers/authHelpers');

const LIST_ENDPOINTS = [
  '/api/contacts',
  '/api/product-categories',
  '/api/products',
  '/api/accounts',
  '/api/journals',
  '/api/analytic-accounts',
  '/api/budgets',
];

describe('Master Data cross-cutting RBAC and audit logging', () => {
  let pool;
  let app;

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
    await createUser(pool, 'CONTACT', { loginId: 'contact' });
  });

  test('every Master Data list endpoint requires authentication', async () => {
    for (const endpoint of LIST_ENDPOINTS) {
      await request(app).get(endpoint).expect(401);
    }
  });

  test('every Master Data list endpoint rejects the CONTACT role with 403', async () => {
    const contactCookie = await login(app, 'contact');
    for (const endpoint of LIST_ENDPOINTS) {
      await request(app).get(endpoint).set('Cookie', contactCookie).expect(403);
    }
  });

  test('ADMIN and ACCOUNTANT can both list every Master Data endpoint', async () => {
    const adminCookie = await login(app, 'admin');
    const accountantCookie = await login(app, 'accountant');
    for (const endpoint of LIST_ENDPOINTS) {
      await request(app).get(endpoint).set('Cookie', adminCookie).expect(200);
      await request(app).get(endpoint).set('Cookie', accountantCookie).expect(200);
    }
  });

  test('contact creation writes a CONTACT_CREATED audit log entry', async () => {
    const adminCookie = await login(app, 'admin');
    const created = await request(app)
      .post('/api/contacts')
      .set('Cookie', adminCookie)
      .send({ name: 'Audit Test Co', type: 'CUSTOMER' })
      .expect(201);

    const auditRows = await pool.query(
      "SELECT action, entity, entity_id FROM audit_logs WHERE entity = 'Contact' AND entity_id = $1",
      [created.body.contact.id],
    );
    expect(auditRows.rows.map((row) => row.action)).toContain('CONTACT_CREATED');
  });

  test('archiving a contact writes a CONTACT_ARCHIVED audit log entry', async () => {
    const adminCookie = await login(app, 'admin');
    const created = await request(app)
      .post('/api/contacts')
      .set('Cookie', adminCookie)
      .send({ name: 'Archive Audit Co', type: 'VENDOR' })
      .expect(201);

    await request(app).post(`/api/contacts/${created.body.contact.id}/archive`).set('Cookie', adminCookie).expect(200);

    const auditRows = await pool.query(
      "SELECT action FROM audit_logs WHERE entity = 'Contact' AND entity_id = $1 AND action = 'CONTACT_ARCHIVED'",
      [created.body.contact.id],
    );
    expect(auditRows.rowCount).toBe(1);
  });

  test('existing authentication (login/logout/me) still works after Master Data changes', async () => {
    const cookie = await login(app, 'admin');
    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(200);
    await request(app).post('/api/auth/logout').set('Cookie', cookie).expect(200);
  });
});
