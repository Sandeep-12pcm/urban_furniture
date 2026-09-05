// Service methods may compose other transactional service methods. PostgreSQL
// does not support independent nested BEGIN/COMMIT blocks: an inner COMMIT
// would commit the caller's work too. Track clients we opened and reuse their
// active transaction so every composed financial operation is all-or-nothing.
const activeTransactions = new WeakSet();

async function withTransaction(db, callback) {
  if (db && typeof db === 'object' && activeTransactions.has(db)) {
    return callback(db);
  }
  if (typeof db.connect === 'function') {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      activeTransactions.add(client);
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      activeTransactions.delete(client);
      client.release();
    }
  }

  await db.query('BEGIN');
  try {
    const result = await callback(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

module.exports = { withTransaction };
