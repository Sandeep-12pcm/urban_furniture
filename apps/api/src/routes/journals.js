const express = require('express');
const { randomUUID } = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../db/audit');
const { parsePagination, buildPaginationMeta } = require('../lib/pagination');
const { mapConstraintError } = require('../lib/masterDataErrors');
const { validateJournal } = require('../masterDataValidation');

const journalSelect = `
  journals.id,
  journals.name,
  journals.type,
  journals.default_account_id AS "defaultAccountId",
  accounts.account_name AS "defaultAccountName",
  accounts.account_code AS "defaultAccountCode",
  journals.description,
  journals.status,
  journals.created_at AS "createdAt",
  journals.updated_at AS "updatedAt",
  journals.archived_at AS "archivedAt"
`;

async function findActiveAccount(db, accountId) {
  const result = await db.query('SELECT id, status FROM accounts WHERE id = $1', [accountId]);
  return result.rows[0] || null;
}

function journalsRoutes(db) {
  const router = express.Router();
  const canManage = [authenticate(db), authorize('ADMIN', 'ACCOUNTANT')];
  const canArchive = [authenticate(db), authorize('ADMIN')];

  router.get('/journals', ...canManage, async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const conditions = [];
      const params = [];

      const status = String(req.query.status || 'ACTIVE').toUpperCase();
      if (status !== 'ALL') {
        params.push(status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE');
        conditions.push(`journals.status = $${params.length}`);
      }

      if (['SALES', 'PURCHASE', 'BANK', 'CASH'].includes(req.query.type)) {
        params.push(req.query.type);
        conditions.push(`journals.type = $${params.length}`);
      }

      if (req.query.search) {
        params.push(`%${String(req.query.search).trim().toLowerCase()}%`);
        conditions.push(`lower(journals.name) LIKE $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM journals ${where}`, params);
      const total = countResult.rows[0].total;

      const result = await db.query(
        `SELECT ${journalSelect} FROM journals
         JOIN accounts ON accounts.id = journals.default_account_id
         ${where}
         ORDER BY journals.name ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );

      return res.json({ journals: result.rows, pagination: buildPaginationMeta({ page, limit, total }) });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/journals/:id', ...canManage, async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT ${journalSelect} FROM journals JOIN accounts ON accounts.id = journals.default_account_id WHERE journals.id = $1`,
        [req.params.id],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Journal not found.' });
      return res.json({ journal: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/journals', ...canManage, async (req, res, next) => {
    try {
      const errors = validateJournal(req.body);
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const account = await findActiveAccount(db, req.body.defaultAccountId);
      if (!account) return res.status(400).json({ message: 'Default account not found.' });
      if (account.status !== 'ACTIVE') return res.status(400).json({ message: 'Cannot assign an archived account as the default account.' });

      const id = randomUUID();
      await db.query(
        `INSERT INTO journals (id, name, type, default_account_id, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, req.body.name.trim(), req.body.type, req.body.defaultAccountId, req.body.description ? String(req.body.description).trim() : null],
      );

      await logAudit(db, {
        userId: req.user.id,
        action: 'JOURNAL_CREATED',
        entity: 'Journal',
        entityId: id,
        metadata: { name: req.body.name, type: req.body.type },
      });

      const created = await db.query(
        `SELECT ${journalSelect} FROM journals JOIN accounts ON accounts.id = journals.default_account_id WHERE journals.id = $1`,
        [id],
      );
      return res.status(201).json({ journal: created.rows[0] });
    } catch (error) {
      const message = mapConstraintError(error, {
        unique: { idx_journals_name_unique: 'Journal name already exists.' },
        foreignKey: 'Default account not found.',
      });
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.patch('/journals/:id', ...canManage, async (req, res, next) => {
    try {
      const errors = validateJournal(req.body, { partial: true });
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const existing = await db.query('SELECT id FROM journals WHERE id = $1', [req.params.id]);
      if (!existing.rowCount) return res.status(404).json({ message: 'Journal not found.' });

      if (req.body.defaultAccountId !== undefined) {
        const account = await findActiveAccount(db, req.body.defaultAccountId);
        if (!account) return res.status(400).json({ message: 'Default account not found.' });
        if (account.status !== 'ACTIVE') return res.status(400).json({ message: 'Cannot assign an archived account as the default account.' });
      }

      const fields = [];
      const params = [];
      const assign = (column, value) => {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      };

      if (req.body.name !== undefined) assign('name', req.body.name.trim());
      if (req.body.type !== undefined) assign('type', req.body.type);
      if (req.body.defaultAccountId !== undefined) assign('default_account_id', req.body.defaultAccountId);
      if (req.body.description !== undefined) assign('description', req.body.description ? String(req.body.description).trim() : null);

      if (!fields.length) return res.status(400).json({ message: 'No changes were provided.' });

      fields.push('updated_at = NOW()');
      params.push(req.params.id);

      await db.query(`UPDATE journals SET ${fields.join(', ')} WHERE id = $${params.length}`, params);

      await logAudit(db, {
        userId: req.user.id,
        action: 'JOURNAL_UPDATED',
        entity: 'Journal',
        entityId: req.params.id,
        metadata: { fields: Object.keys(req.body) },
      });

      const updated = await db.query(
        `SELECT ${journalSelect} FROM journals JOIN accounts ON accounts.id = journals.default_account_id WHERE journals.id = $1`,
        [req.params.id],
      );
      return res.json({ journal: updated.rows[0] });
    } catch (error) {
      const message = mapConstraintError(error, {
        unique: { idx_journals_name_unique: 'Journal name already exists.' },
        foreignKey: 'Default account not found.',
      });
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.post('/journals/:id/archive', ...canArchive, async (req, res, next) => {
    try {
      const result = await db.query(
        `UPDATE journals SET status = 'ARCHIVED', archived_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status = 'ACTIVE' RETURNING id`,
        [req.params.id],
      );
      if (!result.rowCount) {
        const exists = await db.query('SELECT id FROM journals WHERE id = $1', [req.params.id]);
        if (!exists.rowCount) return res.status(404).json({ message: 'Journal not found.' });
        return res.status(400).json({ message: 'Journal is already archived.' });
      }

      await logAudit(db, { userId: req.user.id, action: 'JOURNAL_ARCHIVED', entity: 'Journal', entityId: req.params.id });

      const updated = await db.query(
        `SELECT ${journalSelect} FROM journals JOIN accounts ON accounts.id = journals.default_account_id WHERE journals.id = $1`,
        [req.params.id],
      );
      return res.json({ journal: updated.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/journals/:id/restore', ...canArchive, async (req, res, next) => {
    try {
      const journal = await db.query(
        `SELECT journals.status, accounts.status AS "accountStatus"
         FROM journals JOIN accounts ON accounts.id = journals.default_account_id
         WHERE journals.id = $1`,
        [req.params.id],
      );
      if (!journal.rowCount) return res.status(404).json({ message: 'Journal not found.' });
      if (journal.rows[0].status !== 'ARCHIVED') return res.status(400).json({ message: 'Journal is not archived.' });
      if (journal.rows[0].accountStatus !== 'ACTIVE') {
        return res.status(400).json({ message: 'Cannot restore journal because its default account is archived.' });
      }

      await db.query(`UPDATE journals SET status = 'ACTIVE', archived_at = NULL, updated_at = NOW() WHERE id = $1`, [req.params.id]);

      await logAudit(db, { userId: req.user.id, action: 'JOURNAL_RESTORED', entity: 'Journal', entityId: req.params.id });

      const updated = await db.query(
        `SELECT ${journalSelect} FROM journals JOIN accounts ON accounts.id = journals.default_account_id WHERE journals.id = $1`,
        [req.params.id],
      );
      return res.json({ journal: updated.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { journalsRoutes };
