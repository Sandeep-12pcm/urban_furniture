const { prisma } = require('../config/db');

async function getAllBudgets(query = {}) {
  const { search, isActive, page = 1, limit = 50 } = query;
  const where = {};

  if (isActive !== undefined) {
    where.isActive = isActive === 'true' || isActive === true;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const takeNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * takeNum;

  const [budgets, total] = await Promise.all([
    prisma.budget.findMany({
      where,
      skip,
      take: takeNum,
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { dateFrom: 'desc' },
    }),
    prisma.budget.count({ where }),
  ]);

  return {
    budgets,
    pagination: {
      total,
      page: pageNum,
      limit: takeNum,
      totalPages: Math.ceil(total / takeNum),
    },
  };
}

async function getBudgetById(id) {
  const budget = await prisma.budget.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          analyticAccount: { select: { id: true, code: true, name: true } },
          account: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  if (!budget) {
    const error = new Error(`Budget with ID '${id}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return budget;
}

async function createBudget(data) {
  const itemsData = (data.items || []).map((item) => ({
    analyticAccountId: item.analyticAccountId || null,
    accountId: item.accountId || null,
    plannedAmount: item.plannedAmount !== undefined ? Number(item.plannedAmount) : 0.00,
    practicalAmount: item.practicalAmount !== undefined ? Number(item.practicalAmount) : 0.00,
  }));

  const budget = await prisma.budget.create({
    data: {
      name: data.name.trim(),
      dateFrom: new Date(data.dateFrom),
      dateTo: new Date(data.dateTo),
      description: data.description ? data.description.trim() : null,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      items: itemsData.length > 0 ? { create: itemsData } : undefined,
    },
    include: {
      items: {
        include: {
          analyticAccount: true,
          account: true,
        },
      },
    },
  });

  return budget;
}

async function updateBudget(id, data) {
  await getBudgetById(id);

  const updatePayload = {};
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.dateFrom !== undefined) updatePayload.dateFrom = new Date(data.dateFrom);
  if (data.dateTo !== undefined) updatePayload.dateTo = new Date(data.dateTo);
  if (data.description !== undefined) updatePayload.description = data.description ? data.description.trim() : null;
  if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);

  // If items are provided in update, replace them
  if (data.items !== undefined && Array.isArray(data.items)) {
    const itemsData = data.items.map((item) => ({
      analyticAccountId: item.analyticAccountId || null,
      accountId: item.accountId || null,
      plannedAmount: item.plannedAmount !== undefined ? Number(item.plannedAmount) : 0.00,
      practicalAmount: item.practicalAmount !== undefined ? Number(item.practicalAmount) : 0.00,
    }));

    updatePayload.items = {
      deleteMany: {},
      create: itemsData,
    };
  }

  const budget = await prisma.budget.update({
    where: { id },
    data: updatePayload,
    include: {
      items: {
        include: {
          analyticAccount: true,
          account: true,
        },
      },
    },
  });

  return budget;
}

async function deleteBudget(id) {
  await getBudgetById(id);

  const deleted = await prisma.budget.delete({
    where: { id },
  });

  return { budget: deleted, message: 'Budget deleted successfully.' };
}

module.exports = {
  getAllBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
};
