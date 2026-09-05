const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { login } = require('./helpers/authHelpers');

describe('Product Category API', () => {
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
    await createUser(pool, 'CONTACT', { loginId: 'contact' });
    adminCookie = await login(app, 'admin');
    accountantCookie = await login(app, 'accountant');
  });

  test('creates a category and rejects duplicates case-insensitively', async () => {
    await request(app).post('/api/product-categories').set('Cookie', adminCookie).send({ name: 'Chairs' }).expect(201);

    await request(app)
      .post('/api/product-categories')
      .set('Cookie', accountantCookie)
      .send({ name: 'chairs' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Category name already exists.'));
  });

  test('requires a name', async () => {
    await request(app)
      .post('/api/product-categories')
      .set('Cookie', adminCookie)
      .send({ name: '   ' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Category name is required.'));
  });

  test('cannot be archived while an active product uses it, but can be archived once reassigned', async () => {
    const category = await request(app).post('/api/product-categories').set('Cookie', adminCookie).send({ name: 'Sofas' });
    const categoryId = category.body.category.id;

    const otherCategory = await request(app).post('/api/product-categories').set('Cookie', adminCookie).send({ name: 'Tables' });

    const product = await request(app)
      .post('/api/products')
      .set('Cookie', adminCookie)
      .send({ name: 'L-Shape Sofa', type: 'GOODS', categoryId, salesPrice: 25000, purchasePrice: 18000 })
      .expect(201);

    await request(app)
      .post(`/api/product-categories/${categoryId}/archive`)
      .set('Cookie', adminCookie)
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Category cannot be archived while active products are assigned to it.'));

    await request(app)
      .patch(`/api/products/${product.body.product.id}`)
      .set('Cookie', adminCookie)
      .send({ categoryId: otherCategory.body.category.id })
      .expect(200);

    await request(app).post(`/api/product-categories/${categoryId}/archive`).set('Cookie', adminCookie).expect(200);
    await request(app).post(`/api/product-categories/${categoryId}/restore`).set('Cookie', adminCookie).expect(200);
  });

  test('accountant cannot archive a category', async () => {
    const category = await request(app).post('/api/product-categories').set('Cookie', adminCookie).send({ name: 'Beds' });
    await request(app)
      .post(`/api/product-categories/${category.body.category.id}/archive`)
      .set('Cookie', accountantCookie)
      .expect(403);
  });
});
