const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { config } = require('../config');
const { logAudit } = require('../db/audit');
const { withTransaction } = require('../db/transaction');
const { findUserByIdentifier, findUserByLoginId, toSafeUser } = require('../db/users');
const { clearAuthCookie, setAuthCookie, authenticate } = require('../middleware/auth');
const { validateLogin, validateResetPassword, validateSignup } = require('../validation');

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createJwt(user) {
  return jwt.sign(
    {
      sub: user.id,
      loginId: user.loginId,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

function mapUniqueError(error) {
  if (error.code === '23505' && String(error.constraint).includes('login')) {
    return 'Login ID is already in use.';
  }
  if (error.code === '23505' && String(error.constraint).includes('email')) {
    return 'Email is already registered.';
  }
  return null;
}

function authRoutes(db) {
  const router = express.Router();

  router.post('/login', async (req, res, next) => {
    try {
      const errors = validateLogin(req.body);
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const user = await findUserByLoginId(db, req.body.loginId);
      if (!user) {
        await logAudit(db, {
          action: 'LOGIN_FAILURE',
          entity: 'User',
          metadata: { loginId: req.body.loginId, reason: 'unknown_login_id' },
        });
        return res.status(401).json({ message: 'Invalid Login ID or Password.' });
      }

      if (!user.is_active) {
        await logAudit(db, {
          userId: user.id,
          action: 'LOGIN_FAILURE',
          entity: 'User',
          entityId: user.id,
          metadata: { loginId: user.login_id, reason: 'inactive_account' },
        });
        if (user.role === 'ACCOUNTANT' && user.approval_status === 'PENDING') {
          return res.status(403).json({ message: 'Your accountant account is pending admin approval.' });
        }
        return res.status(403).json({ message: 'Your account is inactive. Please contact the administrator.' });
      }

      const validPassword = await bcrypt.compare(req.body.password, user.password_hash);
      if (!validPassword) {
        await logAudit(db, {
          userId: user.id,
          action: 'LOGIN_FAILURE',
          entity: 'User',
          entityId: user.id,
          metadata: { loginId: user.login_id, reason: 'invalid_password' },
        });
        return res.status(401).json({ message: 'Invalid Login ID or Password.' });
      }

      const updated = await db.query(
        `UPDATE users SET last_login_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING id, login_id AS "loginId", email, role, is_active AS "isActive",
                   contact_id AS "contactId", account_type AS "accountType",
                   approval_status AS "approvalStatus", approved_at AS "approvedAt",
                   approved_by AS "approvedBy", last_login_at AS "lastLoginAt"`,
        [user.id],
      );
      const safeUser = toSafeUser(updated.rows[0]);
      const token = createJwt(safeUser);
      setAuthCookie(res, token);
      await logAudit(db, {
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        entity: 'User',
        entityId: user.id,
        metadata: { loginId: user.login_id, role: user.role },
      });

      return res.json({ authenticated: true, user: safeUser });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/logout', authenticate(db), async (req, res, next) => {
    try {
      clearAuthCookie(res);
      await logAudit(db, {
        userId: req.user.id,
        action: 'LOGOUT',
        entity: 'User',
        entityId: req.user.id,
      });
      return res.json({ authenticated: false });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/me', authenticate(db), (req, res) => {
    return res.json({ user: req.user });
  });

  router.post('/signup', async (req, res, next) => {
    try {
      if (!config.enablePublicSignup) {
        return res.status(403).json({ message: 'Public signup is disabled. Please contact the administrator.' });
      }

      const errors = validateSignup(req.body);
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const accountType = req.body.accountType;
      const role = accountType === 'ACCOUNTANT' ? 'ACCOUNTANT' : 'CONTACT';
      const isActive = accountType !== 'ACCOUNTANT';
      const approvalStatus = accountType === 'ACCOUNTANT' ? 'PENDING' : 'APPROVED';
      const contactType = accountType === 'CUSTOMER' || accountType === 'VENDOR' ? accountType : null;
      const id = randomUUID();
      const passwordHash = await bcrypt.hash(req.body.password, 12);
      const result = await db.query(
        `INSERT INTO users (id, login_id, email, password_hash, role, is_active, account_type, approval_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, login_id AS "loginId", email, role, is_active AS "isActive",
                   contact_id AS "contactId", account_type AS "accountType",
                   approval_status AS "approvalStatus", approved_at AS "approvedAt",
                   approved_by AS "approvedBy", last_login_at AS "lastLoginAt"`,
        [id, req.body.loginId, req.body.email.toLowerCase(), passwordHash, role, isActive, contactType, approvalStatus],
      );

      await logAudit(db, {
        userId: id,
        action: 'USER_CREATED',
        entity: 'User',
        entityId: id,
        metadata: { source: 'public_signup', role, accountType, approvalStatus },
      });

      const safeUser = toSafeUser(result.rows[0]);
      if (!isActive) {
        return res.status(201).json({
          authenticated: false,
          pendingApproval: true,
          user: safeUser,
          message: 'Accountant account request submitted. An Admin must approve it before login.',
        });
      }

      setAuthCookie(res, createJwt(safeUser));
      return res.status(201).json({ authenticated: true, user: safeUser });
    } catch (error) {
      const message = mapUniqueError(error);
      if (message) return res.status(400).json({ message });
      return next(error);
    }
  });

  router.post('/forgot-password', async (req, res, next) => {
    try {
      const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim() : '';
      if (identifier) {
        const user = await findUserByIdentifier(db, identifier);
        if (user && user.is_active) {
          const token = crypto.randomBytes(32).toString('hex');
          const tokenHash = hashResetToken(token);
          await db.query(
            `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
             VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
            [randomUUID(), user.id, tokenHash],
          );
          await logAudit(db, {
            userId: user.id,
            action: 'PASSWORD_RESET_REQUESTED',
            entity: 'User',
            entityId: user.id,
            metadata: { delivery: 'email_pending' },
          });
        }
      }
      return res.json({ message: 'If an account exists, password reset instructions will be sent.' });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/reset-password', async (req, res, next) => {
    try {
      const errors = validateResetPassword(req.body);
      if (errors.length) return res.status(400).json({ message: errors[0], errors });

      const tokenHash = hashResetToken(req.body.token);
      const tokenResult = await db.query(
        `SELECT prt.*, users.is_active
         FROM password_reset_tokens prt
         JOIN users ON users.id = prt.user_id
         WHERE prt.token_hash = $1
         LIMIT 1`,
        [tokenHash],
      );
      const resetToken = tokenResult.rows[0];

      if (!resetToken || resetToken.used_at || resetToken.expires_at <= new Date() || !resetToken.is_active) {
        return res.status(400).json({ message: 'Invalid or expired password reset token.' });
      }

      const passwordHash = await bcrypt.hash(req.body.password, 12);
      await withTransaction(db, async (tx) => {
        await tx.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
          passwordHash,
          resetToken.user_id,
        ]);
        await tx.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [resetToken.id]);
        await logAudit(tx, {
          userId: resetToken.user_id,
          action: 'PASSWORD_RESET_COMPLETED',
          entity: 'User',
          entityId: resetToken.user_id,
        });
      });
      return res.json({ message: 'Password has been reset successfully.' });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { authRoutes, createJwt, mapUniqueError };
