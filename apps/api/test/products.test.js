const request = require('supertest');
const { createApp } = require('../src/app');
const { createTestPool, resetDatabase, createUser } = require('./helpers/testDb');
const { login } = require('./helpers/authHelpers');

describe('Product Master API', () => {
  let pool;
  let app;
  let adminCookie;
  let contactCookie;
  let categoryId;

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
    contactCookie = await login(app, 'contact');

    const category = await request(app).post('/api/product-categories').set('Cookie', adminCookie).send({ name: 'Chairs' });
    categoryId = category.body.category.id;
  });

  test('creates a product with Goods/Service/Combo type', async () => {
    const created = await request(app)
      .post('/api/products')
      .set('Cookie', adminCookie)
      .send({ name: 'Executive Chair', type: 'GOODS', categoryId, salesPrice: 5999, purchasePrice: 4200 })
      .expect(201);

    expect(created.body.product.categoryName).toBe('Chairs');
    expect(created.body.product.salesPrice).toBe('5999.00');
  });

  test('rejects negative prices and an invalid type', async () => {
    await request(app)
      .post('/api/products')
      .set('Cookie', adminCookie)
      .send({ name: 'Bad Price Chair', type: 'GOODS', categoryId, salesPrice: -1, purchasePrice: 10 })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Sales price must be a valid amount and cannot be negative.'));

    await request(app)
      .post('/api/products')
      .set('Cookie', adminCookie)
      .send({ name: 'Bad Type Chair', type: 'KIT', categoryId, salesPrice: 10, purchasePrice: 5 })
      .expect(400);
  });

  test('rejects an unknown or archived category', async () => {
    await request(app)
      .post('/api/products')
      .set('Cookie', adminCookie)
      .send({ name: 'Orphan Chair', type: 'GOODS', categoryId: '00000000-0000-0000-0000-000000000000', salesPrice: 10, purchasePrice: 5 })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Category not found.'));

    await request(app).post(`/api/product-categories/${categoryId}/archive`).set('Cookie', adminCookie).expect(200);

    await request(app)
      .post('/api/products')
      .set('Cookie', adminCookie)
      .send({ name: 'Archived Category Chair', type: 'GOODS', categoryId, salesPrice: 10, purchasePrice: 5 })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Cannot assign an archived category to a product.'));
  });

  test('contact role is denied and unauthenticated is rejected', async () => {
    await request(app).get('/api/products').expect(401);
    await request(app).get('/api/products').set('Cookie', contactCookie).expect(403);
  });

  test('archive and restore a product', async () => {
    const created = await request(app)
      .post('/api/products')
      .set('Cookie', adminCookie)
      .send({ name: 'Dining Table', type: 'GOODS', categoryId, salesPrice: 15000, purchasePrice: 11000 })
      .expect(201);

    await request(app)
      .post(`/api/products/${created.body.product.id}/archive`)
      .set('Cookie', adminCookie)
      .expect(200)
      .expect(({ body }) => expect(body.product.status).toBe('ARCHIVED'));

    await request(app)
      .post(`/api/products/${created.body.product.id}/restore`)
      .set('Cookie', adminCookie)
      .expect(200)
      .expect(({ body }) => expect(body.product.status).toBe('ACTIVE'));
  });

  test('search, category, and type filters work', async () => {
    await request(app).post('/api/products').set('Cookie', adminCookie).send({ name: 'Office Chair', type: 'GOODS', categoryId, salesPrice: 3000, purchasePrice: 2000 });
    await request(app).post('/api/products').set('Cookie', adminCookie).send({ name: 'Assembly Service', type: 'SERVICE', categoryId, salesPrice: 500, purchasePrice: 0 });

    const search = await request(app).get('/api/products?search=office').set('Cookie', adminCookie).expect(200);
    expect(search.body.products).toHaveLength(1);

    const byType = await request(app).get('/api/products?type=SERVICE').set('Cookie', adminCookie).expect(200);
    expect(byType.body.products).toHaveLength(1);
    expect(byType.body.products[0].name).toBe('Assembly Service');
  });
});
