const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { login } = require('./helpers/authHelpers');

describe('Contact Master API', () => {
  let pool;
  let app;
  let adminCookie;
  let accountantCookie;
  let contactCookie;

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
    adminCookie = await login(app, 'admin');
    accountantCookie = await login(app, 'accountant');
    contactCookie = await login(app, 'contact');
  });

  test('unauthenticated requests are rejected', async () => {
    await request(app).get('/api/contacts').expect(401);
    await request(app).post('/api/contacts').send({ name: 'X', type: 'CUSTOMER' }).expect(401);
  });

  test('contact role cannot access master data', async () => {
    await request(app).get('/api/contacts').set('Cookie', contactCookie).expect(403);
    await request(app)
      .post('/api/contacts')
      .set('Cookie', contactCookie)
      .send({ name: 'X', type: 'CUSTOMER' })
      .expect(403);
  });

  test('accountant can create and update, but not archive or restore', async () => {
    const created = await request(app)
      .post('/api/contacts')
      .set('Cookie', accountantCookie)
      .send({ name: 'Nimesh Pathak', type: 'CUSTOMER', email: 'nimesh@example.com' })
      .expect(201);

    expect(created.body.contact.name).toBe('Nimesh Pathak');
    expect(created.body.contact.status).toBe('ACTIVE');

    await request(app)
      .patch(`/api/contacts/${created.body.contact.id}`)
      .set('Cookie', accountantCookie)
      .send({ mobile: '9876543210' })
      .expect(200)
      .expect(({ body }) => expect(body.contact.mobile).toBe('9876543210'));

    await request(app)
      .post(`/api/contacts/${created.body.contact.id}/archive`)
      .set('Cookie', accountantCookie)
      .expect(403);
  });

  test('admin can create, archive, and restore a contact', async () => {
    const created = await request(app)
      .post('/api/contacts')
      .set('Cookie', adminCookie)
      .send({ name: 'Furniture World', type: 'VENDOR' })
      .expect(201);

    const id = created.body.contact.id;

    await request(app)
      .post(`/api/contacts/${id}/archive`)
      .set('Cookie', adminCookie)
      .expect(200)
      .expect(({ body }) => expect(body.contact.status).toBe('ARCHIVED'));

    await request(app).post(`/api/contacts/${id}/archive`).set('Cookie', adminCookie).expect(400);

    await request(app)
      .post(`/api/contacts/${id}/restore`)
      .set('Cookie', adminCookie)
      .expect(200)
      .expect(({ body }) => expect(body.contact.status).toBe('ACTIVE'));

    await request(app).post(`/api/contacts/${id}/restore`).set('Cookie', adminCookie).expect(400);
  });

  test('rejects invalid contact data', async () => {
    await request(app)
      .post('/api/contacts')
      .set('Cookie', adminCookie)
      .send({ name: '', type: 'CUSTOMER' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Contact name is required.'));

    await request(app)
      .post('/api/contacts')
      .set('Cookie', adminCookie)
      .send({ name: 'Bad Type Co', type: 'SOMETHING' })
      .expect(400);

    await request(app)
      .post('/api/contacts')
      .set('Cookie', adminCookie)
      .send({ name: 'Bad Email Co', type: 'CUSTOMER', email: 'not-an-email' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Please enter a valid email address.'));

    await request(app)
      .post('/api/contacts')
      .set('Cookie', adminCookie)
      .send({ name: 'Bad Mobile Co', type: 'CUSTOMER', mobile: '123' })
      .expect(400);

    await request(app)
      .post('/api/contacts')
      .set('Cookie', adminCookie)
      .send({ name: 'Bad Pincode Co', type: 'CUSTOMER', pincode: '12' })
      .expect(400);
  });

  test('creates a linked CONTACT portal account and forces role/type safely', async () => {
    const created = await request(app)
      .post('/api/contacts')
      .set('Cookie', adminCookie)
      .send({
        name: 'Riya Shah',
        type: 'CUSTOMER',
        email: 'riya@example.com',
        createPortalAccount: true,
        portalAccount: { loginId: 'riya.portal', email: 'riya.portal@example.com', password: 'Secure@123' },
      })
      .expect(201);

    expect(created.body.portalUser.role).toBe('CONTACT');
    expect(created.body.portalUser.accountType).toBe('CUSTOMER');
    expect(created.body.portalUser.contactId).toBe(created.body.contact.id);

    // Never allow forcing ADMIN through this flow, even if requested explicitly.
    await request(app)
      .post('/api/contacts')
      .set('Cookie', adminCookie)
      .send({
        name: 'Sneaky Vendor',
        type: 'VENDOR',
        createPortalAccount: true,
        portalAccount: { loginId: 'sneaky', email: 'sneaky@example.com', password: 'Secure@123', role: 'ADMIN' },
      })
      .expect(201)
      .expect(({ body }) => expect(body.portalUser.role).toBe('CONTACT'));
  });

  test('search, type filter, and status filter work on the list endpoint', async () => {
    await request(app).post('/api/contacts').set('Cookie', adminCookie).send({ name: 'Alpha Vendor', type: 'VENDOR' });
    await request(app).post('/api/contacts').set('Cookie', adminCookie).send({ name: 'Beta Customer', type: 'CUSTOMER', email: 'beta@example.com' });

    const search = await request(app).get('/api/contacts?search=beta').set('Cookie', adminCookie).expect(200);
    expect(search.body.contacts).toHaveLength(1);
    expect(search.body.contacts[0].name).toBe('Beta Customer');

    const filtered = await request(app).get('/api/contacts?type=VENDOR').set('Cookie', adminCookie).expect(200);
    expect(filtered.body.contacts).toHaveLength(1);
    expect(filtered.body.contacts[0].type).toBe('VENDOR');

    const archiveTarget = search.body.contacts[0].id;
    await request(app).post(`/api/contacts/${archiveTarget}/archive`).set('Cookie', adminCookie).expect(200);

    const activeOnly = await request(app).get('/api/contacts').set('Cookie', adminCookie).expect(200);
    expect(activeOnly.body.contacts.map((c) => c.name)).not.toContain('Beta Customer');

    const archivedOnly = await request(app).get('/api/contacts?status=ARCHIVED').set('Cookie', adminCookie).expect(200);
    expect(archivedOnly.body.contacts.map((c) => c.name)).toContain('Beta Customer');
  });

  test('returns 404 for a missing contact', async () => {
    await request(app)
      .get('/api/contacts/00000000-0000-0000-0000-000000000000')
      .set('Cookie', adminCookie)
      .expect(404);
  });
});
