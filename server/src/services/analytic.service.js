const { prisma } = require('../config/db');

async function getAllAnalyticAccounts(query = {}) {
  const { search, isActive, page = 1, limit = 50 } = query;
  const where = {};

  if (isActive !== undefined) {
    where.isActive = isActive === 'true' || isActive === true;
  }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const takeNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * takeNum;

  const [analyticAccounts, total] = await Promise.all([
    prisma.analyticAccount.findMany({
      where,
      skip,
      take: takeNum,
      orderBy: { code: 'asc' },
    }),
    prisma.analyticAccount.count({ where }),
  ]);

  return {
    analyticAccounts,
    pagination: {
      total,
      page: pageNum,
      limit: takeNum,
      totalPages: Math.ceil(total / takeNum),
    },
  };
}

async function getAnalyticAccountById(id) {
  const account = await prisma.analyticAccount.findUnique({
    where: { id },
    include: {
      budgetItems: {
        include: {
          budget: { select: { id: true, name: true, dateFrom: true, dateTo: true } },
          account: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  if (!account) {
    const error = new Error(`Analytic Account with ID '${id}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return account;
}

async function createAnalyticAccount(data) {
  const code = data.code.trim().toUpperCase();

  const existing = await prisma.analyticAccount.findUnique({
    where: { code },
  });

  if (existing) {
    const error = new Error(`An analytic account with code '${code}' already exists.`);
    error.statusCode = 409;
    throw error;
  }

  const account = await prisma.analyticAccount.create({
    data: {
      code,
      name: data.name.trim(),
      description: data.description ? data.description.trim() : null,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    },
  });

  return account;
}

async function updateAnalyticAccount(id, data) {
  await getAnalyticAccountById(id);

  if (data.code) {
    const code = data.code.trim().toUpperCase();
    const existing = await prisma.analyticAccount.findFirst({
      where: {
        code,
        NOT: { id },
      },
    });
    if (existing) {
      const error = new Error(`An analytic account with code '${code}' already exists.`);
      error.statusCode = 409;
      throw error;
    }
  }

  const updatePayload = {};
  if (data.code !== undefined) updatePayload.code = data.code.trim().toUpperCase();
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.description !== undefined) updatePayload.description = data.description ? data.description.trim() : null;
  if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);

  const account = await prisma.analyticAccount.update({
    where: { id },
    data: updatePayload,
  });

  return account;
}

async function deleteAnalyticAccount(id) {
  await getAnalyticAccountById(id);

  const [itemsCount, budgetCount] = await Promise.all([
    prisma.journalItem.count({ where: { analyticAccountId: id } }),
    prisma.budgetItem.count({ where: { analyticAccountId: id } }),
  ]);

  if (itemsCount > 0 || budgetCount > 0) {
    const archived = await prisma.analyticAccount.update({
      where: { id },
      data: { isActive: false },
    });
    return { analyticAccount: archived, archived: true, message: 'Analytic account is linked to budget/journal entries and was archived.' };
  }

  const deleted = await prisma.analyticAccount.delete({
    where: { id },
  });

  return { analyticAccount: deleted, archived: false, message: 'Analytic account deleted successfully.' };
}

module.exports = {
  getAllAnalyticAccounts,
  getAnalyticAccountById,
  createAnalyticAccount,
  updateAnalyticAccount,
  deleteAnalyticAccount,
};
