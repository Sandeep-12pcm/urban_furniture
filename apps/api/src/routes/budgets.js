const express = require('express');
const { randomUUID } = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../db/audit');
const { parsePagination, buildPaginationMeta } = require('../lib/pagination');
const { mapConstraintError } = require('../lib/masterDataErrors');
const { validateBudget } = require('../masterDataValidation');

const budgetSelect = `
  budgets.id,
  budgets.name,
  budgets.period_start AS "periodStart",
  budgets.period_end AS "periodEnd",
  budgets.planned_amount AS "plannedAmount",
  budgets.responsible_user_id AS "responsibleUserId",
  users.login_id AS "responsibleUserLoginId",
  budgets.analytic_account_id AS "analyticAccountId",
  analytic_accounts.name AS "analyticAccountName",
  budgets.status,
  budgets.created_at AS "createdAt",
  budgets.updated_at AS "updatedAt",
  budgets.archived_at AS "archivedAt"
`;

const JOIN = `
  JOIN users ON users.id = budgets.responsible_user_id
  JOIN analytic_accounts ON analytic_accounts.id = budgets.analytic_account_id
`;

async function findActiveUser(db, userId) {
  const result = await db.query('SELECT id, is_active FROM users WHERE id = $1', [userId]);
  return result.rows[0] || null;
}

async function findActiveAnalyticAccount(db, analyticAccountId) {
  const result = await db.query('SELECT id, status FROM analytic_accounts WHERE id = $1', [analyticAccountId]);
  return result.rows[0] || null;
}

function budgetsRoutes(db) {
  const router = express.Router();
  const canManage = [authenticate(db), authorize('ADMIN', 'ACCOUNTANT')];
  const canArchive = [authenticate(db), authorize('ADMIN')];

  router.get('/budgets', ...canManage, async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const conditions = [];
      const params = [];

      const status = String(req.query.status || 'ACTIVE').toUpperCase();
      if (status !== 'ALL') {
        params.push(status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE');
        conditions.push(`budgets.status = $${params.length}`);
      }

      if (req.query.analyticAccountId) {
        params.push(req.query.analyticAccountId);
        conditions.push(`budgets.analytic_account_id = $${params.length}`);
      }

      if (req.query.search) {
        params.push(`%${String(req.query.search).trim().toLowerCase()}%`);
        conditions.push(`lower(budgets.name) LIKE $${params.length}`);
      }

      if (req.query.periodFrom) {
        params.push(req.query.periodFrom);
        conditions.push(`budgets.period_end >= $${params.length}`);
      }

      if (req.query.periodTo) {
        params.push(req.query.periodTo);
        conditions.push(`budgets.period_start <= $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM budgets ${where}`, params);
      const total = countResult.rows[0].total;

      const result = await db.query(
        `SELECT ${budgetSelect} FROM budgets ${JOIN} ${where}
         ORDER BY budgets.period_start DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );

      return res.json({ budgets: result.rows, pagination: buildPaginationMeta({ page, limit, total }) });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/budgets/:id', ...canManage, async (req, res, next) => {
    try {
      const result = await db.query(`SELECT ${budgetSelect} FROM budgets ${JOIN} WHERE budgets.id = $1`, [req.params.id]);
      if (!result.rowCount) return res.status(404).json({ message: 'Budget not found.' });
      return res.json({ budget: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/budgets', ...canManage, async (req, res, next) => {
    try {
      const errors = validateBudget(req.body);
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const responsibleUser = await findActiveUser(db, req.body.responsibleUserId);
      if (!responsibleUser) return res.status(400).json({ message: 'Responsible person not found.' });
      if (!responsibleUser.is_active) return res.status(400).json({ message: 'Responsible person must be an active user.' });

      const analyticAccount = await findActiveAnalyticAccount(db, req.body.analyticAccountId);
      if (!analyticAccount) return res.status(400).json({ message: 'Analytic account not found.' });
      if (analyticAccount.status !== 'ACTIVE') return res.status(400).json({ message: 'Cannot assign an archived analytic account to a budget.' });

      const id = randomUUID();
      await db.query(
        `INSERT INTO budgets (id, name, period_start, period_end, planned_amount, responsible_user_id, analytic_account_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          req.body.name.trim(),
          req.body.periodStart,
          req.body.periodEnd,
          req.body.plannedAmount,
          req.body.responsibleUserId,
          req.body.analyticAccountId,
        ],
      );

      await logAudit(db, {
        userId: req.user.id,
        action: 'BUDGET_CREATED',
        entity: 'Budget',
        entityId: id,
        metadata: { name: req.body.name },
      });

      const created = await db.query(`SELECT ${budgetSelect} FROM budgets ${JOIN} WHERE budgets.id = $1`, [id]);
      return res.status(201).json({ budget: created.rows[0] });
    } catch (error) {
      const message = mapConstraintError(error, {
        foreignKey: 'Referenced record was not found.',
        check: 'Budget end date cannot be before start date.',
      });
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.patch('/budgets/:id', ...canManage, async (req, res, next) => {
    try {
      const errors = validateBudget(req.body, { partial: true });
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const existing = await db.query('SELECT id, period_start, period_end FROM budgets WHERE id = $1', [req.params.id]);
      if (!existing.rowCount) return res.status(404).json({ message: 'Budget not found.' });

      if (req.body.responsibleUserId !== undefined) {
        const responsibleUser = await findActiveUser(db, req.body.responsibleUserId);
        if (!responsibleUser) return res.status(400).json({ message: 'Responsible person not found.' });
        if (!responsibleUser.is_active) return res.status(400).json({ message: 'Responsible person must be an active user.' });
      }

      if (req.body.analyticAccountId !== undefined) {
        const analyticAccount = await findActiveAnalyticAccount(db, req.body.analyticAccountId);
        if (!analyticAccount) return res.status(400).json({ message: 'Analytic account not found.' });
        if (analyticAccount.status !== 'ACTIVE') return res.status(400).json({ message: 'Cannot assign an archived analytic account to a budget.' });
      }

      const nextStart = req.body.periodStart !== undefined ? req.body.periodStart : existing.rows[0].period_start;
      const nextEnd = req.body.periodEnd !== undefined ? req.body.periodEnd : existing.rows[0].period_end;
      if (new Date(nextEnd) < new Date(nextStart)) {
        return res.status(400).json({ message: 'Budget end date cannot be before start date.' });
      }

      const fields = [];
      const params = [];
      const assign = (column, value) => {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      };

      if (req.body.name !== undefined) assign('name', req.body.name.trim());
      if (req.body.periodStart !== undefined) assign('period_start', req.body.periodStart);
      if (req.body.periodEnd !== undefined) assign('period_end', req.body.periodEnd);
      if (req.body.plannedAmount !== undefined) assign('planned_amount', req.body.plannedAmount);
      if (req.body.responsibleUserId !== undefined) assign('responsible_user_id', req.body.responsibleUserId);
      if (req.body.analyticAccountId !== undefined) assign('analytic_account_id', req.body.analyticAccountId);

      if (!fields.length) return res.status(400).json({ message: 'No changes were provided.' });

      fields.push('updated_at = NOW()');
      params.push(req.params.id);

      await db.query(`UPDATE budgets SET ${fields.join(', ')} WHERE id = $${params.length}`, params);

      await logAudit(db, {
        userId: req.user.id,
        action: 'BUDGET_UPDATED',
        entity: 'Budget',
        entityId: req.params.id,
        metadata: { fields: Object.keys(req.body) },
      });

      const updated = await db.query(`SELECT ${budgetSelect} FROM budgets ${JOIN} WHERE budgets.id = $1`, [req.params.id]);
      return res.json({ budget: updated.rows[0] });
    } catch (error) {
      const message = mapConstraintError(error, {
        foreignKey: 'Referenced record was not found.',
        check: 'Budget end date cannot be before start date.',
      });
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.post('/budgets/:id/archive', ...canArchive, async (req, res, next) => {
    try {
      const result = await db.query(
        `UPDATE budgets SET status = 'ARCHIVED', archived_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status = 'ACTIVE' RETURNING id`,
        [req.params.id],
      );
      if (!result.rowCount) {
        const exists = await db.query('SELECT id FROM budgets WHERE id = $1', [req.params.id]);
        if (!exists.rowCount) return res.status(404).json({ message: 'Budget not found.' });
        return res.status(400).json({ message: 'Budget is already archived.' });
      }

      await logAudit(db, { userId: req.user.id, action: 'BUDGET_ARCHIVED', entity: 'Budget', entityId: req.params.id });

      const updated = await db.query(`SELECT ${budgetSelect} FROM budgets ${JOIN} WHERE budgets.id = $1`, [req.params.id]);
      return res.json({ budget: updated.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/budgets/:id/restore', ...canArchive, async (req, res, next) => {
    try {
      const result = await db.query(
        `UPDATE budgets SET status = 'ACTIVE', archived_at = NULL, updated_at = NOW()
         WHERE id = $1 AND status = 'ARCHIVED' RETURNING id`,
        [req.params.id],
      );
      if (!result.rowCount) {
        const exists = await db.query('SELECT id FROM budgets WHERE id = $1', [req.params.id]);
        if (!exists.rowCount) return res.status(404).json({ message: 'Budget not found.' });
        return res.status(400).json({ message: 'Budget is not archived.' });
      }

      await logAudit(db, { userId: req.user.id, action: 'BUDGET_RESTORED', entity: 'Budget', entityId: req.params.id });

      const updated = await db.query(`SELECT ${budgetSelect} FROM budgets ${JOIN} WHERE budgets.id = $1`, [req.params.id]);
      return res.json({ budget: updated.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { budgetsRoutes };
