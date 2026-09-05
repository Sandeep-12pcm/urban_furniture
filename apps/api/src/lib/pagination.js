function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildPaginationMeta({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) };
}

module.exports = { parsePagination, buildPaginationMeta };
