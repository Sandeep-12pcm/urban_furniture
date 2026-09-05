const bcrypt = require('bcryptjs');
const express = require('express');
const { randomUUID } = require('crypto');
const { logAudit } = require('../db/audit');
const { withTransaction } = require('../db/transaction');
const { authenticate, authorize } = require('../middleware/auth');
const { mapUniqueError } = require('./auth');
const { validateUserCreation } = require('../validation');
const { safeUserSelect, toSafeUser } = require('../db/users');

function usersRoutes(db) {
  const router = express.Router();

  router.post('/users', authenticate(db), authorize('ADMIN'), async (req, res, next) => {
    try {
      const errors = validateUserCreation(req.body);
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const id = randomUUID();
      const passwordHash = await bcrypt.hash(req.body.password, 12);
      const contactId = req.body.role === 'CONTACT' && req.body.contactId ? req.body.contactId.trim() : null;
      const result = await withTransaction(db, async (tx) => {
        const created = await tx.query(
          `INSERT INTO users (id, login_id, email, password_hash, role, contact_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, login_id AS "loginId", email, role, is_active AS "isActive",
                     contact_id AS "contactId", account_type AS "accountType",
                     approval_status AS "approvalStatus", approved_at AS "approvedAt",
                     approved_by AS "approvedBy", created_at AS "createdAt"`,
          [
            id,
            req.body.loginId,
            req.body.email.toLowerCase(),
            passwordHash,
            req.body.role,
            contactId,
          ],
        );

        await logAudit(tx, {
          userId: req.user.id,
          action: 'USER_CREATED',
          entity: 'User',
          entityId: id,
          metadata: { createdRole: req.body.role, createdLoginId: req.body.loginId },
        });

        return created;
      });

      return res.status(201).json({ user: result.rows[0] });
    } catch (error) {
      const message = mapUniqueError(error);
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.get('/users', authenticate(db), async (req, res, next) => {
    try {
      let result;
      if (req.user.role === 'ADMIN') {
        result = await db.query(`SELECT ${safeUserSelect} FROM users ORDER BY created_at DESC`);
      } else if (req.user.role === 'ACCOUNTANT') {
        result = await db.query(
          `SELECT ${safeUserSelect}
           FROM users
           WHERE id = $1 OR role = 'CONTACT'
           ORDER BY created_at DESC`,
          [req.user.id],
        );
      } else {
        result = await db.query(`SELECT ${safeUserSelect} FROM users WHERE id = $1`, [req.user.id]);
      }

      return res.json({ users: result.rows.map(toSafeUser) });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/users/:id/approve-accountant', authenticate(db), authorize('ADMIN'), async (req, res, next) => {
    try {
      const target = await db.query(
        'SELECT id, role, approval_status FROM users WHERE id = $1 LIMIT 1',
        [req.params.id],
      );

      if (target.rowCount === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }
      if (target.rows[0].role !== 'ACCOUNTANT') {
        return res.status(400).json({ message: 'Only accountant accounts require approval.' });
      }

      const result = await db.query(
        `UPDATE users
         SET is_active = TRUE,
             approval_status = 'APPROVED',
             approved_at = NOW(),
             approved_by = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING ${safeUserSelect}`,
        [req.params.id, req.user.id],
      );

      await logAudit(db, {
        userId: req.user.id,
        action: 'ACCOUNTANT_APPROVED',
        entity: 'User',
        entityId: req.params.id,
      });

      return res.json({ user: toSafeUser(result.rows[0]) });
    } catch (error) {
      return next(error);
    }
  });

  // Lightweight directory of active internal users for Master Data pickers
  // (e.g. Budget "Responsible Person"). Scoped narrower than /users so an
  // Accountant can still see Admin/Accountant options without gaining
  // access to full user administration.
  router.get('/users/assignable', authenticate(db), authorize('ADMIN', 'ACCOUNTANT'), async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT id, login_id AS "loginId", email, role
         FROM users
         WHERE is_active = TRUE AND role IN ('ADMIN', 'ACCOUNTANT')
         ORDER BY login_id ASC`,
      );
      return res.json({ users: result.rows });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/admin/health', authenticate(db), authorize('ADMIN'), (_req, res) => {
    return res.json({ ok: true, scope: 'admin' });
  });

  router.get('/contact/portal', authenticate(db), authorize('CONTACT'), (req, res) => {
    return res.json({ ok: true, userId: req.user.id, contactId: req.user.contactId });
  });

  return router;
}

module.exports = { usersRoutes };
