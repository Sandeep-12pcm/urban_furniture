const express = require('express');
const { randomUUID } = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../db/audit');
const { parsePagination, buildPaginationMeta } = require('../lib/pagination');
const { mapConstraintError } = require('../lib/masterDataErrors');
const { validateAnalyticAccount } = require('../masterDataValidation');

const analyticSelect = `
  id,
  name,
  type,
  description,
  status,
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  archived_at AS "archivedAt"
`;

function analyticAccountsRoutes(db) {
  const router = express.Router();
  const canManage = [authenticate(db), authorize('ADMIN', 'ACCOUNTANT')];
  const canArchive = [authenticate(db), authorize('ADMIN')];

  router.get('/analytic-accounts', ...canManage, async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const conditions = [];
      const params = [];

      const status = String(req.query.status || 'ACTIVE').toUpperCase();
      if (status !== 'ALL') {
        params.push(status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE');
        conditions.push(`status = $${params.length}`);
      }

      if (['INCOME', 'EXPENSE'].includes(req.query.type)) {
        params.push(req.query.type);
        conditions.push(`type = $${params.length}`);
      }

      if (req.query.search) {
        params.push(`%${String(req.query.search).trim().toLowerCase()}%`);
        conditions.push(`lower(name) LIKE $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM analytic_accounts ${where}`, params);
      const total = countResult.rows[0].total;

      const result = await db.query(
        `SELECT ${analyticSelect} FROM analytic_accounts ${where}
         ORDER BY name ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );

      return res.json({ analyticAccounts: result.rows, pagination: buildPaginationMeta({ page, limit, total }) });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/analytic-accounts/:id', ...canManage, async (req, res, next) => {
    try {
      const result = await db.query(`SELECT ${analyticSelect} FROM analytic_accounts WHERE id = $1`, [req.params.id]);
      if (!result.rowCount) return res.status(404).json({ message: 'Analytic account not found.' });
      return res.json({ analyticAccount: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/analytic-accounts', ...canManage, async (req, res, next) => {
    try {
      const errors = validateAnalyticAccount(req.body);
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const id = randomUUID();
      const result = await db.query(
        `INSERT INTO analytic_accounts (id, name, type, description)
         VALUES ($1, $2, $3, $4)
         RETURNING ${analyticSelect}`,
        [id, req.body.name.trim(), req.body.type, req.body.description ? String(req.body.description).trim() : null],
      );

      await logAudit(db, {
        userId: req.user.id,
        action: 'ANALYTIC_ACCOUNT_CREATED',
        entity: 'AnalyticAccount',
        entityId: id,
        metadata: { name: req.body.name, type: req.body.type },
      });

      return res.status(201).json({ analyticAccount: result.rows[0] });
    } catch (error) {
      const message = mapConstraintError(error, { unique: { idx_analytic_accounts_name_unique: 'Analytic account name already exists.' } });
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.patch('/analytic-accounts/:id', ...canManage, async (req, res, next) => {
    try {
      const errors = validateAnalyticAccount(req.body, { partial: true });
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const existing = await db.query('SELECT id FROM analytic_accounts WHERE id = $1', [req.params.id]);
      if (!existing.rowCount) return res.status(404).json({ message: 'Analytic account not found.' });

      const fields = [];
      const params = [];
      const assign = (column, value) => {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      };

      if (req.body.name !== undefined) assign('name', req.body.name.trim());
      if (req.body.type !== undefined) assign('type', req.body.type);
      if (req.body.description !== undefined) assign('description', req.body.description ? String(req.body.description).trim() : null);

      if (!fields.length) return res.status(400).json({ message: 'No changes were provided.' });

      fields.push('updated_at = NOW()');
      params.push(req.params.id);

      const result = await db.query(
        `UPDATE analytic_accounts SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING ${analyticSelect}`,
        params,
      );

      await logAudit(db, {
        userId: req.user.id,
        action: 'ANALYTIC_ACCOUNT_UPDATED',
        entity: 'AnalyticAccount',
        entityId: req.params.id,
        metadata: { fields: Object.keys(req.body) },
      });

      return res.json({ analyticAccount: result.rows[0] });
    } catch (error) {
      const message = mapConstraintError(error, { unique: { idx_analytic_accounts_name_unique: 'Analytic account name already exists.' } });
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.post('/analytic-accounts/:id/archive', ...canArchive, async (req, res, next) => {
    try {
      const existing = await db.query('SELECT id, status FROM analytic_accounts WHERE id = $1', [req.params.id]);
      if (!existing.rowCount) return res.status(404).json({ message: 'Analytic account not found.' });
      if (existing.rows[0].status === 'ARCHIVED') return res.status(400).json({ message: 'Analytic account is already archived.' });

      const activeBudgets = await db.query(
        `SELECT COUNT(*)::int AS total FROM budgets WHERE analytic_account_id = $1 AND status = 'ACTIVE'`,
        [req.params.id],
      );
      if (activeBudgets.rows[0].total > 0) {
        return res.status(400).json({ message: 'Analytic account cannot be archived while it is used by an active budget.' });
      }

      const result = await db.query(
        `UPDATE analytic_accounts SET status = 'ARCHIVED', archived_at = NOW(), updated_at = NOW()
         WHERE id = $1 RETURNING ${analyticSelect}`,
        [req.params.id],
      );

      await logAudit(db, { userId: req.user.id, action: 'ANALYTIC_ACCOUNT_ARCHIVED', entity: 'AnalyticAccount', entityId: req.params.id });
      return res.json({ analyticAccount: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/analytic-accounts/:id/restore', ...canArchive, async (req, res, next) => {
    try {
      const result = await db.query(
        `UPDATE analytic_accounts SET status = 'ACTIVE', archived_at = NULL, updated_at = NOW()
         WHERE id = $1 AND status = 'ARCHIVED' RETURNING ${analyticSelect}`,
        [req.params.id],
      );
      if (!result.rowCount) {
        const exists = await db.query('SELECT id FROM analytic_accounts WHERE id = $1', [req.params.id]);
        if (!exists.rowCount) return res.status(404).json({ message: 'Analytic account not found.' });
        return res.status(400).json({ message: 'Analytic account is not archived.' });
      }
      await logAudit(db, { userId: req.user.id, action: 'ANALYTIC_ACCOUNT_RESTORED', entity: 'AnalyticAccount', entityId: req.params.id });
      return res.json({ analyticAccount: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { analyticAccountsRoutes };
