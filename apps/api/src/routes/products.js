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
  products.sku,
  products.barcode,
  products.tax_rate AS "taxRate",
  products.image_url AS "imageUrl",
  products.type,
  products.sales_price AS "salesPrice",
  products.purchase_price AS "purchasePrice",
  products.category_id AS "categoryId",
  product_categories.name AS "categoryName",
  COALESCE(inventory_stock.quantity, 0)::text AS "stockQuantity",
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
        conditions.push(`(lower(products.name) LIKE $${params.length} OR lower(coalesce(products.sku, '')) LIKE $${params.length} OR lower(coalesce(products.barcode, '')) LIKE $${params.length})`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM products ${where}`, params);
      const total = countResult.rows[0].total;

      const result = await db.query(
        `SELECT ${productSelect} FROM products
         JOIN product_categories ON product_categories.id = products.category_id
         LEFT JOIN inventory_stock ON inventory_stock.product_id = products.id
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
         LEFT JOIN inventory_stock ON inventory_stock.product_id = products.id
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

      const sku = req.body.sku ? String(req.body.sku).trim() : null;
      const barcode = req.body.barcode ? String(req.body.barcode).trim() : null;
      const taxRate = req.body.taxRate !== undefined && req.body.taxRate !== null && req.body.taxRate !== '' ? Number(req.body.taxRate) : 18.00;
      const imageUrl = req.body.imageUrl ? String(req.body.imageUrl).trim() : null;

      const id = randomUUID();
      await db.query(
        `INSERT INTO products (id, name, type, sales_price, purchase_price, category_id, sku, barcode, tax_rate, image_url, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
        [id, req.body.name.trim(), req.body.type, req.body.salesPrice, req.body.purchasePrice, req.body.categoryId, sku, barcode, taxRate, imageUrl, req.user.id],
      );

      const initialStock = req.body.initialStock !== undefined && req.body.initialStock !== null && req.body.initialStock !== ''
        ? Number(req.body.initialStock)
        : (req.body.stock !== undefined && req.body.stock !== null && req.body.stock !== '' ? Number(req.body.stock) : 0);

      if (req.body.type === 'GOODS' && initialStock > 0) {
        const cost = Number(req.body.purchasePrice) || 0;
        await db.query(
          `INSERT INTO inventory_stock (id, product_id, quantity, average_cost, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (product_id) DO UPDATE SET quantity = inventory_stock.quantity + EXCLUDED.quantity`,
          [randomUUID(), id, initialStock, cost],
        );
        await db.query(
          `INSERT INTO inventory_movements (id, product_id, movement_type, quantity, unit_cost, reference_type, movement_date, notes, created_by_id)
           VALUES ($1, $2, 'ADJUSTMENT_IN', $3, $4, 'INITIAL_STOCK', CURRENT_DATE, 'Initial stock setup', $5)`,
          [randomUUID(), id, initialStock, cost, req.user.id],
        );
      }

      await logAudit(db, {
        userId: req.user.id,
        action: 'PRODUCT_CREATED',
        entity: 'Product',
        entityId: id,
        metadata: { name: req.body.name, type: req.body.type, sku, barcode, taxRate },
      });

      const created = await db.query(
        `SELECT ${productSelect} FROM products
         JOIN product_categories ON product_categories.id = products.category_id
         LEFT JOIN inventory_stock ON inventory_stock.product_id = products.id
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

      const existing = await db.query('SELECT id, type, purchase_price FROM products WHERE id = $1', [req.params.id]);
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
      if (req.body.sku !== undefined) assign('sku', req.body.sku ? String(req.body.sku).trim() : null);
      if (req.body.barcode !== undefined) assign('barcode', req.body.barcode ? String(req.body.barcode).trim() : null);
      if (req.body.taxRate !== undefined) assign('tax_rate', req.body.taxRate !== null && req.body.taxRate !== '' ? Number(req.body.taxRate) : 18.00);
      if (req.body.imageUrl !== undefined) assign('image_url', req.body.imageUrl ? String(req.body.imageUrl).trim() : null);

      const targetStock = req.body.stock !== undefined ? req.body.stock : req.body.stockQuantity;
      const hasStockUpdate = targetStock !== undefined && targetStock !== null && targetStock !== '';

      if (!fields.length && !hasStockUpdate) return res.status(400).json({ message: 'No changes were provided.' });

      if (fields.length) {
        assign('updated_by', req.user.id);
        fields.push('updated_at = NOW()');
        params.push(req.params.id);
        await db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = $${params.length}`, params);
      }

      if (hasStockUpdate) {
        const nextStock = Number(targetStock);
        if (Number.isFinite(nextStock) && nextStock >= 0) {
          const currentStockRes = await db.query('SELECT quantity, average_cost FROM inventory_stock WHERE product_id = $1', [req.params.id]);
          const currentStock = currentStockRes.rowCount ? Number(currentStockRes.rows[0].quantity) : 0;
          const currentCost = currentStockRes.rowCount ? Number(currentStockRes.rows[0].average_cost) : (Number(req.body.purchasePrice || existing.rows[0].purchase_price) || 0);
          const diff = nextStock - currentStock;
          if (diff !== 0) {
            if (currentStockRes.rowCount) {
              await db.query('UPDATE inventory_stock SET quantity = $1, updated_at = NOW() WHERE product_id = $2', [nextStock, req.params.id]);
            } else {
              await db.query('INSERT INTO inventory_stock (id, product_id, quantity, average_cost, updated_at) VALUES ($1, $2, $3, $4, NOW())', [randomUUID(), req.params.id, nextStock, currentCost]);
            }
            await db.query(
              `INSERT INTO inventory_movements (id, product_id, movement_type, quantity, unit_cost, reference_type, movement_date, notes, created_by_id)
               VALUES ($1, $2, $3, $4, $5, 'MANUAL_ADJUSTMENT', CURRENT_DATE, 'Product edit stock adjustment', $6)`,
              [randomUUID(), req.params.id, diff > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', Math.abs(diff), currentCost, req.user.id],
            );
          }
        }
      }

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
         LEFT JOIN inventory_stock ON inventory_stock.product_id = products.id
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
         LEFT JOIN inventory_stock ON inventory_stock.product_id = products.id
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
         LEFT JOIN inventory_stock ON inventory_stock.product_id = products.id
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
