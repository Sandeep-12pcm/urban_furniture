// Maps raw PostgreSQL constraint-violation error codes to safe, professional
// messages so route handlers never leak database internals to API clients.
//
// error.code reference: 23505 = unique_violation, 23503 = foreign_key_violation,
// 23514 = check_violation.
function mapConstraintError(error, { unique = {}, foreignKey, check } = {}) {
  if (!error || !error.code) return null;

  if (error.code === '23505') {
    const constraint = String(error.constraint || '');
    for (const key of Object.keys(unique)) {
      if (constraint.includes(key)) return unique[key];
    }
    return 'This record already exists.';
  }

  if (error.code === '23503' && foreignKey) {
    return foreignKey;
  }

  if (error.code === '23514' && check) {
    return check;
  }

  return null;
}

module.exports = { mapConstraintError };
