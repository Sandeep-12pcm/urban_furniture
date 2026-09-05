const safeUserSelect = `
  id,
  login_id AS "loginId",
  email,
  role,
  is_active AS "isActive",
  contact_id AS "contactId",
  account_type AS "accountType",
  approval_status AS "approvalStatus",
  approved_at AS "approvedAt",
  approved_by AS "approvedBy",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  last_login_at AS "lastLoginAt"
`;

function toSafeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    loginId: row.loginId,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    contactId: row.contactId,
    accountType: row.accountType,
    approvalStatus: row.approvalStatus,
    approvedAt: row.approvedAt,
    approvedBy: row.approvedBy,
    lastLoginAt: row.lastLoginAt,
  };
}

async function findUserByLoginId(db, loginId) {
  const result = await db.query('SELECT * FROM users WHERE login_id = $1 LIMIT 1', [loginId]);
  return result.rows[0] || null;
}

async function findUserByIdentifier(db, identifier) {
  const normalized = identifier.toLowerCase();
  const result = await db.query(
    'SELECT * FROM users WHERE login_id = $1 OR email = $2 LIMIT 1',
    [identifier, normalized],
  );
  return result.rows[0] || null;
}

async function findSafeUserById(db, id) {
  const result = await db.query(`SELECT ${safeUserSelect} FROM users WHERE id = $1 LIMIT 1`, [id]);
  return toSafeUser(result.rows[0]);
}

module.exports = {
  safeUserSelect,
  toSafeUser,
  findUserByLoginId,
  findUserByIdentifier,
  findSafeUserById,
};
