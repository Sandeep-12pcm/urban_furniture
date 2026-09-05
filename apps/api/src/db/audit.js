const { randomUUID } = require('crypto');

async function logAudit(db, { userId = null, action, entity, entityId = null, metadata = null }) {
  await db.query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      randomUUID(),
      userId,
      action,
      entity,
      entityId,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
}

module.exports = { logAudit };
