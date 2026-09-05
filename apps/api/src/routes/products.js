const express = require('express');
const { randomUUID } = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../db/audit');
const { parsePagination, buildPaginationMeta } = require('../lib/pagination');
const { mapConstraintError } = require('../lib/masterDataErrors');
const { validateProduct } = require('../masterDataValidation');

const productSelect = `
  products.id,
  products.name,
  products.type,
  products.sales_price AS "salesPrice",
  products.purchase_price AS "purchasePrice",
  products.category_id AS "categoryId",
  product_categories.name AS "categoryName",
  products.status,
  products.created_at AS "createdAt",
  products.updated_at AS "updatedAt",
  products.archived_at AS "archivedAt",
  products.created_by AS "createdBy",
  products.updated_by AS "updatedBy"
`;

async function findActiveCategory(db, categoryId) {
  const result = await db.query('SELECT id, status FROM product_categories WHERE id = $1', [categoryId]);
  return result.rows[0] || null;
}

function productsRoutes(db) {
  const router = express.Router();
  const canManage = [authenticate(db), authorize('ADMIN', 'ACCOUNTANT')];
  const canArchive = [authenticate(db), authorize('ADMIN')];

  router.get('/products', ...canManage, async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const conditions = [];
      const params = [];

      const status = String(req.query.status || 'ACTIVE').toUpperCase();
      if (status !== 'ALL') {
        params.push(status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE');
        conditions.push(`products.status = $${params.length}`);
      }

      if (['GOODS', 'SERVICE', 'COMBO'].includes(req.query.type)) {
        params.push(req.query.type);
        conditions.push(`products.type = $${params.length}`);
      }

      if (req.query.categoryId) {
        params.push(req.query.categoryId);
        conditions.push(`products.category_id = $${params.length}`);
      }

      if (req.query.search) {
        params.push(`%${String(req.query.search).trim().toLowerCase()}%`);
        conditions.push(`lower(products.name) LIKE $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM products ${where}`, params);
      const total = countResult.rows[0].total;

      const result = await db.query(
        `SELECT ${productSelect} FROM products
         JOIN product_categories ON product_categories.id = products.category_id
         ${where}
         ORDER BY products.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );

      return res.json({ products: result.rows, pagination: buildPaginationMeta({ page, limit, total }) });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/products/:id', ...canManage, async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT ${productSelect} FROM products
         JOIN product_categories ON product_categories.id = products.category_id
         WHERE products.id = $1`,
        [req.params.id],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Product not found.' });
      return res.json({ product: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/products', ...canManage, async (req, res, next) => {
    try {
      const errors = validateProduct(req.body);
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const category = await findActiveCategory(db, req.body.categoryId);
      if (!category) return res.status(400).json({ message: 'Category not found.' });
      if (category.status !== 'ACTIVE') {
        return res.status(400).json({ message: 'Cannot assign an archived category to a product.' });
      }

      const id = randomUUID();
      const result = await db.query(
        `INSERT INTO products (id, name, type, sales_price, purchase_price, category_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         RETURNING id`,
        [id, req.body.name.trim(), req.body.type, req.body.salesPrice, req.body.purchasePrice, req.body.categoryId, req.user.id],
      );

      await logAudit(db, {
        userId: req.user.id,
        action: 'PRODUCT_CREATED',
        entity: 'Product',
        entityId: result.rows[0].id,
        metadata: { name: req.body.name, type: req.body.type },
      });

      const created = await db.query(
        `SELECT ${productSelect} FROM products
         JOIN product_categories ON product_categories.id = products.category_id
         WHERE products.id = $1`,
        [id],
      );

      return res.status(201).json({ product: created.rows[0] });
    } catch (error) {
      const message = mapConstraintError(error, { foreignKey: 'Category not found.' });
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.patch('/products/:id', ...canManage, async (req, res, next) => {
    try {
      const errors = validateProduct(req.body, { partial: true });
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const existing = await db.query('SELECT id FROM products WHERE id = $1', [req.params.id]);
      if (!existing.rowCount) return res.status(404).json({ message: 'Product not found.' });

      if (req.body.categoryId !== undefined) {
        const category = await findActiveCategory(db, req.body.categoryId);
        if (!category) return res.status(400).json({ message: 'Category not found.' });
        if (category.status !== 'ACTIVE') {
          return res.status(400).json({ message: 'Cannot assign an archived category to a product.' });
        }
      }

      const fields = [];
      const params = [];
      const assign = (column, value) => {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      };

      if (req.body.name !== undefined) assign('name', req.body.name.trim());
      if (req.body.type !== undefined) assign('type', req.body.type);
      if (req.body.categoryId !== undefined) assign('category_id', req.body.categoryId);
      if (req.body.salesPrice !== undefined) assign('sales_price', req.body.salesPrice);
      if (req.body.purchasePrice !== undefined) assign('purchase_price', req.body.purchasePrice);

      if (!fields.length) return res.status(400).json({ message: 'No changes were provided.' });

      assign('updated_by', req.user.id);
      fields.push('updated_at = NOW()');
      params.push(req.params.id);

      await db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = $${params.length}`, params);

      await logAudit(db, {
        userId: req.user.id,
        action: 'PRODUCT_UPDATED',
        entity: 'Product',
        entityId: req.params.id,
        metadata: { fields: Object.keys(req.body) },
      });

      const updated = await db.query(
        `SELECT ${productSelect} FROM products
         JOIN product_categories ON product_categories.id = products.category_id
         WHERE products.id = $1`,
        [req.params.id],
      );

      return res.json({ product: updated.rows[0] });
    } catch (error) {
      const message = mapConstraintError(error, { foreignKey: 'Category not found.' });
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.post('/products/:id/archive', ...canArchive, async (req, res, next) => {
    try {
      const result = await db.query(
        `UPDATE products SET status = 'ARCHIVED', archived_at = NOW(), updated_by = $2, updated_at = NOW()
         WHERE id = $1 AND status = 'ACTIVE' RETURNING id`,
        [req.params.id, req.user.id],
      );
      if (!result.rowCount) {
        const exists = await db.query('SELECT id FROM products WHERE id = $1', [req.params.id]);
        if (!exists.rowCount) return res.status(404).json({ message: 'Product not found.' });
        return res.status(400).json({ message: 'Product is already archived.' });
      }

      await logAudit(db, { userId: req.user.id, action: 'PRODUCT_ARCHIVED', entity: 'Product', entityId: req.params.id });

      const updated = await db.query(
        `SELECT ${productSelect} FROM products
         JOIN product_categories ON product_categories.id = products.category_id
         WHERE products.id = $1`,
        [req.params.id],
      );
      return res.json({ product: updated.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/products/:id/restore', ...canArchive, async (req, res, next) => {
    try {
      const product = await db.query(
        `SELECT products.status, product_categories.status AS "categoryStatus"
         FROM products JOIN product_categories ON product_categories.id = products.category_id
         WHERE products.id = $1`,
        [req.params.id],
      );
      if (!product.rowCount) return res.status(404).json({ message: 'Product not found.' });
      if (product.rows[0].status !== 'ARCHIVED') return res.status(400).json({ message: 'Product is not archived.' });
      if (product.rows[0].categoryStatus !== 'ACTIVE') {
        return res.status(400).json({ message: 'Cannot restore product because its category is archived. Restore the category first.' });
      }

      await db.query(
        `UPDATE products SET status = 'ACTIVE', archived_at = NULL, updated_by = $2, updated_at = NOW() WHERE id = $1`,
        [req.params.id, req.user.id],
      );

      await logAudit(db, { userId: req.user.id, action: 'PRODUCT_RESTORED', entity: 'Product', entityId: req.params.id });

      const updated = await db.query(
        `SELECT ${productSelect} FROM products
         JOIN product_categories ON product_categories.id = products.category_id
         WHERE products.id = $1`,
        [req.params.id],
      );
      return res.json({ product: updated.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { productsRoutes };
