const express = require('express');
const { randomUUID } = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../db/audit');
const { parsePagination, buildPaginationMeta } = require('../lib/pagination');
const { mapConstraintError } = require('../lib/masterDataErrors');
const { validateProductCategory } = require('../masterDataValidation');

const categorySelect = `
  id,
  name,
  description,
  status,
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  archived_at AS "archivedAt"
`;

function productCategoriesRoutes(db) {
  const router = express.Router();
  const canManage = [authenticate(db), authorize('ADMIN', 'ACCOUNTANT')];
  const canArchive = [authenticate(db), authorize('ADMIN')];

  router.get('/product-categories', ...canManage, async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const conditions = [];
      const params = [];

      const status = String(req.query.status || 'ACTIVE').toUpperCase();
      if (status !== 'ALL') {
        params.push(status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE');
        conditions.push(`status = $${params.length}`);
      }

      if (req.query.search) {
        params.push(`%${String(req.query.search).trim().toLowerCase()}%`);
        conditions.push(`lower(name) LIKE $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM product_categories ${where}`, params);
      const total = countResult.rows[0].total;

      const result = await db.query(
        `SELECT ${categorySelect} FROM product_categories ${where}
         ORDER BY name ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );

      return res.json({ categories: result.rows, pagination: buildPaginationMeta({ page, limit, total }) });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/product-categories/:id', ...canManage, async (req, res, next) => {
    try {
      const result = await db.query(`SELECT ${categorySelect} FROM product_categories WHERE id = $1`, [req.params.id]);
      if (!result.rowCount) return res.status(404).json({ message: 'Category not found.' });
      return res.json({ category: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/product-categories', ...canManage, async (req, res, next) => {
    try {
      const errors = validateProductCategory(req.body);
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const id = randomUUID();
      const result = await db.query(
        `INSERT INTO product_categories (id, name, description)
         VALUES ($1, $2, $3)
         RETURNING ${categorySelect}`,
        [id, req.body.name.trim(), req.body.description ? String(req.body.description).trim() : null],
      );

      await logAudit(db, {
        userId: req.user.id,
        action: 'CATEGORY_CREATED',
        entity: 'ProductCategory',
        entityId: id,
        metadata: { name: req.body.name },
      });

      return res.status(201).json({ category: result.rows[0] });
    } catch (error) {
      const message = mapConstraintError(error, { unique: { idx_product_categories_name_unique: 'Category name already exists.' } });
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.patch('/product-categories/:id', ...canManage, async (req, res, next) => {
    try {
      const errors = validateProductCategory(req.body, { partial: true });
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const existing = await db.query('SELECT id FROM product_categories WHERE id = $1', [req.params.id]);
      if (!existing.rowCount) return res.status(404).json({ message: 'Category not found.' });

      const fields = [];
      const params = [];
      const assign = (column, value) => {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      };

      if (req.body.name !== undefined) assign('name', req.body.name.trim());
      if (req.body.description !== undefined) {
        assign('description', req.body.description ? String(req.body.description).trim() : null);
      }

      if (!fields.length) return res.status(400).json({ message: 'No changes were provided.' });

      fields.push('updated_at = NOW()');
      params.push(req.params.id);

      const result = await db.query(
        `UPDATE product_categories SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING ${categorySelect}`,
        params,
      );

      await logAudit(db, {
        userId: req.user.id,
        action: 'CATEGORY_UPDATED',
        entity: 'ProductCategory',
        entityId: req.params.id,
        metadata: { fields: Object.keys(req.body) },
      });

      return res.json({ category: result.rows[0] });
    } catch (error) {
      const message = mapConstraintError(error, { unique: { idx_product_categories_name_unique: 'Category name already exists.' } });
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.post('/product-categories/:id/archive', ...canArchive, async (req, res, next) => {
    try {
      const existing = await db.query('SELECT id, status FROM product_categories WHERE id = $1', [req.params.id]);
      if (!existing.rowCount) return res.status(404).json({ message: 'Category not found.' });
      if (existing.rows[0].status === 'ARCHIVED') {
        return res.status(400).json({ message: 'Category is already archived.' });
      }

      const activeProducts = await db.query(
        `SELECT COUNT(*)::int AS total FROM products WHERE category_id = $1 AND status = 'ACTIVE'`,
        [req.params.id],
      );
      if (activeProducts.rows[0].total > 0) {
        return res.status(400).json({ message: 'Category cannot be archived while active products are assigned to it.' });
      }

      const result = await db.query(
        `UPDATE product_categories SET status = 'ARCHIVED', archived_at = NOW(), updated_at = NOW()
         WHERE id = $1 RETURNING ${categorySelect}`,
        [req.params.id],
      );

      await logAudit(db, { userId: req.user.id, action: 'CATEGORY_ARCHIVED', entity: 'ProductCategory', entityId: req.params.id });
      return res.json({ category: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/product-categories/:id/restore', ...canArchive, async (req, res, next) => {
    try {
      const result = await db.query(
        `UPDATE product_categories SET status = 'ACTIVE', archived_at = NULL, updated_at = NOW()
         WHERE id = $1 AND status = 'ARCHIVED' RETURNING ${categorySelect}`,
        [req.params.id],
      );
      if (!result.rowCount) {
        const exists = await db.query('SELECT id FROM product_categories WHERE id = $1', [req.params.id]);
        if (!exists.rowCount) return res.status(404).json({ message: 'Category not found.' });
        return res.status(400).json({ message: 'Category is not archived.' });
      }
      await logAudit(db, { userId: req.user.id, action: 'CATEGORY_RESTORED', entity: 'ProductCategory', entityId: req.params.id });
      return res.json({ category: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { productCategoriesRoutes };
