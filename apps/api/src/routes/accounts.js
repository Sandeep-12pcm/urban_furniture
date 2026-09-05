const express = require('express');
const { randomUUID } = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../db/audit');
const { mapConstraintError } = require('../lib/masterDataErrors');
const { parsePagination, buildPaginationMeta } = require('../lib/pagination');
const { validateAccount } = require('../masterDataValidation');

const accountSelect = `
  id,
  account_code AS "accountCode",
  account_name AS "accountName",
  type,
  description,
  parent_account_id AS "parentAccountId",
  status,
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  archived_at AS "archivedAt"
`;

function accountsRoutes(db) {
  const router = express.Router();
  const canManage = [authenticate(db), authorize('ADMIN', 'ACCOUNTANT')];
  const canArchive = [authenticate(db), authorize('ADMIN')];

  // Returns the full chart, ordered for a tree UI: by type, then by account code.
  router.get('/accounts', ...canManage, async (req, res, next) => {
    try {
      const conditions = [];
      const params = [];

      const status = String(req.query.status || 'ACTIVE').toUpperCase();
      if (status !== 'ALL') {
        params.push(status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE');
        conditions.push(`status = $${params.length}`);
      }

      if (['ASSET', 'LIABILITY', 'EXPENSE', 'INCOME', 'CAPITAL'].includes(req.query.type)) {
        params.push(req.query.type);
        conditions.push(`type = $${params.length}`);
      }

      if (req.query.search) {
        params.push(`%${String(req.query.search).trim().toLowerCase()}%`);
        const idx = params.length;
        conditions.push(`(lower(account_name) LIKE $${idx} OR lower(account_code) LIKE $${idx})`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      if (req.query.page !== undefined || req.query.limit !== undefined) {
        const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25, maxLimit: 1000 });
        const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM accounts ${where}`, params);
        const total = countResult.rows[0].total;

        const result = await db.query(
          `SELECT ${accountSelect} FROM accounts ${where} ORDER BY type ASC, account_code ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset],
        );

        return res.json({
          accounts: result.rows,
          pagination: buildPaginationMeta({ page, limit, total }),
        });
      }

      const result = await db.query(
        `SELECT ${accountSelect} FROM accounts ${where} ORDER BY type ASC, account_code ASC`,
        params,
      );

      // The Chart of Accounts is rendered as a tree by default when unpaginated.
      return res.json({
        accounts: result.rows,
        pagination: { page: 1, limit: result.rowCount, total: result.rowCount, totalPages: 1 },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/accounts/:id', ...canManage, async (req, res, next) => {
    try {
      const result = await db.query(`SELECT ${accountSelect} FROM accounts WHERE id = $1`, [req.params.id]);
      if (!result.rowCount) return res.status(404).json({ message: 'Account not found.' });
      return res.json({ account: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/accounts', ...canManage, async (req, res, next) => {
    try {
      const errors = validateAccount(req.body);
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      let parentAccountId = null;
      if (req.body.parentAccountId) {
        const parent = await db.query('SELECT id FROM accounts WHERE id = $1', [req.body.parentAccountId]);
        if (!parent.rowCount) return res.status(400).json({ message: 'Parent account not found.' });
        parentAccountId = req.body.parentAccountId;
      }

      const id = randomUUID();
      const result = await db.query(
        `INSERT INTO accounts (id, account_code, account_name, type, description, parent_account_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${accountSelect}`,
        [
          id,
          req.body.accountCode.trim(),
          req.body.accountName.trim(),
          req.body.type,
          req.body.description ? String(req.body.description).trim() : null,
          parentAccountId,
        ],
      );

      await logAudit(db, {
        userId: req.user.id,
        action: 'ACCOUNT_CREATED',
        entity: 'Account',
        entityId: id,
        metadata: { accountCode: req.body.accountCode, type: req.body.type },
      });

      return res.status(201).json({ account: result.rows[0] });
    } catch (error) {
      const message = mapConstraintError(error, {
        unique: { idx_accounts_code_unique: 'Account code already exists.' },
        foreignKey: 'Parent account not found.',
      });
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.patch('/accounts/:id', ...canManage, async (req, res, next) => {
    try {
      const errors = validateAccount(req.body, { partial: true });
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const existing = await db.query('SELECT id FROM accounts WHERE id = $1', [req.params.id]);
      if (!existing.rowCount) return res.status(404).json({ message: 'Account not found.' });

      if (req.body.parentAccountId !== undefined && req.body.parentAccountId !== null) {
        if (req.body.parentAccountId === req.params.id) {
          return res.status(400).json({ message: 'An account cannot be its own parent.' });
        }
        const parent = await db.query('SELECT id FROM accounts WHERE id = $1', [req.body.parentAccountId]);
        if (!parent.rowCount) return res.status(400).json({ message: 'Parent account not found.' });
      }

      const fields = [];
      const params = [];
      const assign = (column, value) => {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      };

      if (req.body.accountCode !== undefined) assign('account_code', req.body.accountCode.trim());
      if (req.body.accountName !== undefined) assign('account_name', req.body.accountName.trim());
      if (req.body.type !== undefined) assign('type', req.body.type);
      if (req.body.description !== undefined) assign('description', req.body.description ? String(req.body.description).trim() : null);
      if (req.body.parentAccountId !== undefined) assign('parent_account_id', req.body.parentAccountId || null);

      if (!fields.length) return res.status(400).json({ message: 'No changes were provided.' });

      fields.push('updated_at = NOW()');
      params.push(req.params.id);

      const result = await db.query(
        `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING ${accountSelect}`,
        params,
      );

      await logAudit(db, {
        userId: req.user.id,
        action: 'ACCOUNT_UPDATED',
        entity: 'Account',
        entityId: req.params.id,
        metadata: { fields: Object.keys(req.body) },
      });

      return res.json({ account: result.rows[0] });
    } catch (error) {
      const message = mapConstraintError(error, {
        unique: { idx_accounts_code_unique: 'Account code already exists.' },
        foreignKey: 'Parent account not found.',
      });
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.post('/accounts/:id/archive', ...canArchive, async (req, res, next) => {
    try {
      const existing = await db.query('SELECT id, status FROM accounts WHERE id = $1', [req.params.id]);
      if (!existing.rowCount) return res.status(404).json({ message: 'Account not found.' });
      if (existing.rows[0].status === 'ARCHIVED') return res.status(400).json({ message: 'Account is already archived.' });

      const inUse = await db.query(
        `SELECT
           (SELECT COUNT(*) FROM accounts WHERE parent_account_id = $1 AND status = 'ACTIVE') AS "activeChildren",
           (SELECT COUNT(*) FROM journals WHERE default_account_id = $1 AND status = 'ACTIVE') AS "activeJournals"`,
        [req.params.id],
      );
      const { activeChildren, activeJournals } = inUse.rows[0];
      if (Number(activeChildren) > 0 || Number(activeJournals) > 0) {
        return res.status(400).json({ message: 'Account cannot be archived because it is currently in use.' });
      }

      const result = await db.query(
        `UPDATE accounts SET status = 'ARCHIVED', archived_at = NOW(), updated_at = NOW()
         WHERE id = $1 RETURNING ${accountSelect}`,
        [req.params.id],
      );

      await logAudit(db, { userId: req.user.id, action: 'ACCOUNT_ARCHIVED', entity: 'Account', entityId: req.params.id });
      return res.json({ account: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/accounts/:id/restore', ...canArchive, async (req, res, next) => {
    try {
      const result = await db.query(
        `UPDATE accounts SET status = 'ACTIVE', archived_at = NULL, updated_at = NOW()
         WHERE id = $1 AND status = 'ARCHIVED' RETURNING ${accountSelect}`,
        [req.params.id],
      );
      if (!result.rowCount) {
        const exists = await db.query('SELECT id FROM accounts WHERE id = $1', [req.params.id]);
        if (!exists.rowCount) return res.status(404).json({ message: 'Account not found.' });
        return res.status(400).json({ message: 'Account is not archived.' });
      }
      await logAudit(db, { userId: req.user.id, action: 'ACCOUNT_RESTORED', entity: 'Account', entityId: req.params.id });
      return res.json({ account: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { accountsRoutes };
