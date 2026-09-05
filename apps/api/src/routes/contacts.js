const bcrypt = require('bcryptjs');
const express = require('express');
const { randomUUID } = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../db/audit');
const { withTransaction } = require('../db/transaction');
const { parsePagination, buildPaginationMeta } = require('../lib/pagination');
const { mapConstraintError } = require('../lib/masterDataErrors');
const { validateContact, validateCreatePortalAccount } = require('../masterDataValidation');
const { mapUniqueError } = require('./auth');

const contactSelect = `
  id,
  name,
  type,
  email,
  mobile,
  city,
  state,
  pincode,
  profile_image_url AS "profileImageUrl",
  status,
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  archived_at AS "archivedAt",
  created_by AS "createdBy",
  updated_by AS "updatedBy"
`;

const SORT_COLUMNS = { name: 'name', createdAt: 'created_at' };

function contactsRoutes(db) {
  const router = express.Router();
  const canManage = [authenticate(db), authorize('ADMIN', 'ACCOUNTANT')];
  const canArchive = [authenticate(db), authorize('ADMIN')];

  router.get('/contacts', ...canManage, async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const conditions = [];
      const params = [];

      const status = String(req.query.status || 'ACTIVE').toUpperCase();
      if (status !== 'ALL') {
        params.push(status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE');
        conditions.push(`status = $${params.length}`);
      }

      if (['CUSTOMER', 'VENDOR', 'BOTH'].includes(req.query.type)) {
        params.push(req.query.type);
        conditions.push(`type = $${params.length}`);
      }

      if (req.query.search) {
        params.push(`%${String(req.query.search).trim().toLowerCase()}%`);
        const idx = params.length;
        conditions.push(`(lower(name) LIKE $${idx} OR lower(email) LIKE $${idx} OR mobile LIKE $${idx})`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const sortColumn = SORT_COLUMNS[req.query.sortBy] || 'created_at';
      const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';

      const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM contacts ${where}`, params);
      const total = countResult.rows[0].total;

      const result = await db.query(
        `SELECT ${contactSelect} FROM contacts ${where}
         ORDER BY ${sortColumn} ${sortDir}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );

      return res.json({ contacts: result.rows, pagination: buildPaginationMeta({ page, limit, total }) });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/contacts/:id', ...canManage, async (req, res, next) => {
    try {
      const result = await db.query(`SELECT ${contactSelect} FROM contacts WHERE id = $1`, [req.params.id]);
      if (!result.rowCount) return res.status(404).json({ message: 'Contact not found.' });
      return res.json({ contact: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/contacts', ...canManage, async (req, res, next) => {
    try {
      const errors = validateContact(req.body);
      if (req.body.createPortalAccount) {
        errors.push(...validateCreatePortalAccount(req.body.portalAccount));
      }
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const id = randomUUID();
      const payload = await withTransaction(db, async (tx) => {
        const inserted = await tx.query(
          `INSERT INTO contacts (id, name, type, email, mobile, city, state, pincode, profile_image_url, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
           RETURNING ${contactSelect}`,
          [
            id,
            req.body.name.trim(),
            req.body.type,
            req.body.email ? req.body.email.trim().toLowerCase() : null,
            req.body.mobile ? req.body.mobile.trim() : null,
            req.body.city ? req.body.city.trim() : null,
            req.body.state ? req.body.state.trim() : null,
            req.body.pincode ? req.body.pincode.trim() : null,
            req.body.profileImageUrl ? String(req.body.profileImageUrl).trim() : null,
            req.user.id,
          ],
        );

        await logAudit(tx, {
          userId: req.user.id,
          action: 'CONTACT_CREATED',
          entity: 'Contact',
          entityId: id,
          metadata: { name: req.body.name, type: req.body.type },
        });

        let portalUser = null;
        if (req.body.createPortalAccount) {
          const portal = req.body.portalAccount || {};
          const passwordHash = await bcrypt.hash(portal.password, 12);
          const userId = randomUUID();
          // Portal accounts created from Contact Master are always CONTACT role.
          // ADMIN can never be selected or forced through this flow.
          const createdUser = await tx.query(
            `INSERT INTO users (id, login_id, email, password_hash, role, contact_id, account_type)
             VALUES ($1, $2, $3, $4, 'CONTACT', $5, $6)
             RETURNING id, login_id AS "loginId", email, role, contact_id AS "contactId", account_type AS "accountType"`,
            [
              userId,
              portal.loginId.trim(),
              portal.email.trim().toLowerCase(),
              passwordHash,
              id,
              req.body.type === 'VENDOR' ? 'VENDOR' : 'CUSTOMER',
            ],
          );

          await logAudit(tx, {
            userId: req.user.id,
            action: 'USER_CREATED',
            entity: 'User',
            entityId: userId,
            metadata: { source: 'contact_portal_account', contactId: id, role: 'CONTACT' },
          });

          portalUser = createdUser.rows[0];
        }

        return { contact: inserted.rows[0], portalUser };
      });

      return res.status(201).json(payload);
    } catch (error) {
      const message = mapUniqueError(error) || mapConstraintError(error, {
        foreignKey: 'Referenced record was not found.',
      });
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.patch('/contacts/:id', ...canManage, async (req, res, next) => {
    try {
      const errors = validateContact(req.body, { partial: true });
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const existing = await db.query('SELECT id FROM contacts WHERE id = $1', [req.params.id]);
      if (!existing.rowCount) return res.status(404).json({ message: 'Contact not found.' });

      const fields = [];
      const params = [];
      const assign = (column, value) => {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      };

      if (req.body.name !== undefined) assign('name', req.body.name.trim());
      if (req.body.type !== undefined) assign('type', req.body.type);
      if (req.body.email !== undefined) assign('email', req.body.email ? req.body.email.trim().toLowerCase() : null);
      if (req.body.mobile !== undefined) assign('mobile', req.body.mobile ? req.body.mobile.trim() : null);
      if (req.body.city !== undefined) assign('city', req.body.city ? req.body.city.trim() : null);
      if (req.body.state !== undefined) assign('state', req.body.state ? req.body.state.trim() : null);
      if (req.body.pincode !== undefined) assign('pincode', req.body.pincode ? req.body.pincode.trim() : null);
      if (req.body.profileImageUrl !== undefined) {
        assign('profile_image_url', req.body.profileImageUrl ? String(req.body.profileImageUrl).trim() : null);
      }

      if (!fields.length) return res.status(400).json({ message: 'No changes were provided.' });

      assign('updated_by', req.user.id);
      fields.push('updated_at = NOW()');
      params.push(req.params.id);

      const result = await db.query(
        `UPDATE contacts SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING ${contactSelect}`,
        params,
      );

      await logAudit(db, {
        userId: req.user.id,
        action: 'CONTACT_UPDATED',
        entity: 'Contact',
        entityId: req.params.id,
        metadata: { fields: Object.keys(req.body) },
      });

      return res.json({ contact: result.rows[0] });
    } catch (error) {
      const message = mapUniqueError(error);
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.post('/contacts/:id/archive', ...canArchive, async (req, res, next) => {
    try {
      const result = await db.query(
        `UPDATE contacts SET status = 'ARCHIVED', archived_at = NOW(), updated_by = $2, updated_at = NOW()
         WHERE id = $1 AND status = 'ACTIVE' RETURNING ${contactSelect}`,
        [req.params.id, req.user.id],
      );
      if (!result.rowCount) {
        const exists = await db.query('SELECT id FROM contacts WHERE id = $1', [req.params.id]);
        if (!exists.rowCount) return res.status(404).json({ message: 'Contact not found.' });
        return res.status(400).json({ message: 'Contact is already archived.' });
      }
      await logAudit(db, { userId: req.user.id, action: 'CONTACT_ARCHIVED', entity: 'Contact', entityId: req.params.id });
      return res.json({ contact: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/contacts/:id/restore', ...canArchive, async (req, res, next) => {
    try {
      const result = await db.query(
        `UPDATE contacts SET status = 'ACTIVE', archived_at = NULL, updated_by = $2, updated_at = NOW()
         WHERE id = $1 AND status = 'ARCHIVED' RETURNING ${contactSelect}`,
        [req.params.id, req.user.id],
      );
      if (!result.rowCount) {
        const exists = await db.query('SELECT id FROM contacts WHERE id = $1', [req.params.id]);
        if (!exists.rowCount) return res.status(404).json({ message: 'Contact not found.' });
        return res.status(400).json({ message: 'Contact is not archived.' });
      }
      await logAudit(db, { userId: req.user.id, action: 'CONTACT_RESTORED', entity: 'Contact', entityId: req.params.id });
      return res.json({ contact: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { contactsRoutes };
