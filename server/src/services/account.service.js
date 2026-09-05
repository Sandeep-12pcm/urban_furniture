const { prisma } = require('../config/db');

async function getAllAccounts(query = {}) {
  const { type, search, isActive, page = 1, limit = 100 } = query;
  const where = {};

  if (type) {
    where.type = type;
  }

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
  const takeNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 100));
  const skip = (pageNum - 1) * takeNum;

  const [accounts, total] = await Promise.all([
    prisma.account.findMany({
      where,
      skip,
      take: takeNum,
      orderBy: { code: 'asc' },
    }),
    prisma.account.count({ where }),
  ]);

  return {
    accounts,
    pagination: {
      total,
      page: pageNum,
      limit: takeNum,
      totalPages: Math.ceil(total / takeNum),
    },
  };
}

async function getAccountById(id) {
  const account = await prisma.account.findUnique({
    where: { id },
  });

  if (!account) {
    const error = new Error(`Account with ID '${id}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return account;
}

async function createAccount(data) {
  const code = data.code.trim();

  const existing = await prisma.account.findUnique({
    where: { code },
  });

  if (existing) {
    const error = new Error(`An account with code '${code}' already exists.`);
    error.statusCode = 409;
    throw error;
  }

  const account = await prisma.account.create({
    data: {
      code,
      name: data.name.trim(),
      type: data.type,
      currentBalance: data.currentBalance !== undefined ? Number(data.currentBalance) : 0.00,
      description: data.description ? data.description.trim() : null,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    },
  });

  return account;
}

async function updateAccount(id, data) {
  await getAccountById(id);

  if (data.code) {
    const code = data.code.trim();
    const existing = await prisma.account.findFirst({
      where: {
        code,
        NOT: { id },
      },
    });
    if (existing) {
      const error = new Error(`An account with code '${code}' already exists.`);
      error.statusCode = 409;
      throw error;
    }
  }

  const updatePayload = {};
  if (data.code !== undefined) updatePayload.code = data.code.trim();
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.type !== undefined) updatePayload.type = data.type;
  if (data.currentBalance !== undefined) updatePayload.currentBalance = Number(data.currentBalance);
  if (data.description !== undefined) updatePayload.description = data.description ? data.description.trim() : null;
  if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);

  const account = await prisma.account.update({
    where: { id },
    data: updatePayload,
  });

  return account;
}

async function deleteAccount(id) {
  await getAccountById(id);

  // Check references in journal items, products, journals
  const [itemsCount, productsCount, journalsCount] = await Promise.all([
    prisma.journalItem.count({ where: { accountId: id } }),
    prisma.product.count({
      where: {
        OR: [{ salesAccountId: id }, { expenseAccountId: id }],
      },
    }),
    prisma.journal.count({
      where: {
        OR: [{ defaultDebitAccountId: id }, { defaultCreditAccountId: id }],
      },
    }),
  ]);

  if (itemsCount > 0 || productsCount > 0 || journalsCount > 0) {
    const archived = await prisma.account.update({
      where: { id },
      data: { isActive: false },
    });
    return { account: archived, archived: true, message: 'Account is linked to transactions/journals and was archived.' };
  }

  const deleted = await prisma.account.delete({
    where: { id },
  });

  return { account: deleted, archived: false, message: 'Account deleted successfully.' };
}

module.exports = {
  getAllAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
};
