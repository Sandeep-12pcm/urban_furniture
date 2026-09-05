const { prisma } = require('../config/db');

async function getAllJournals(query = {}) {
  const { type, search, isActive, page = 1, limit = 50 } = query;
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
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const takeNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * takeNum;

  const [journals, total] = await Promise.all([
    prisma.journal.findMany({
      where,
      skip,
      take: takeNum,
      include: {
        defaultDebitAccount: { select: { id: true, code: true, name: true } },
        defaultCreditAccount: { select: { id: true, code: true, name: true } },
      },
      orderBy: { code: 'asc' },
    }),
    prisma.journal.count({ where }),
  ]);

  return {
    journals,
    pagination: {
      total,
      page: pageNum,
      limit: takeNum,
      totalPages: Math.ceil(total / takeNum),
    },
  };
}

async function getJournalById(id) {
  const journal = await prisma.journal.findUnique({
    where: { id },
    include: {
      defaultDebitAccount: true,
      defaultCreditAccount: true,
    },
  });

  if (!journal) {
    const error = new Error(`Journal with ID '${id}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return journal;
}

async function createJournal(data) {
  const code = data.code.trim().toUpperCase();

  const existing = await prisma.journal.findUnique({
    where: { code },
  });

  if (existing) {
    const error = new Error(`A journal with code '${code}' already exists.`);
    error.statusCode = 409;
    throw error;
  }

  if (data.defaultDebitAccountId) {
    const acc = await prisma.account.findUnique({ where: { id: data.defaultDebitAccountId } });
    if (!acc) {
      const error = new Error(`Debit account with ID '${data.defaultDebitAccountId}' does not exist.`);
      error.statusCode = 400;
      throw error;
    }
  }

  if (data.defaultCreditAccountId) {
    const acc = await prisma.account.findUnique({ where: { id: data.defaultCreditAccountId } });
    if (!acc) {
      const error = new Error(`Credit account with ID '${data.defaultCreditAccountId}' does not exist.`);
      error.statusCode = 400;
      throw error;
    }
  }

  const journal = await prisma.journal.create({
    data: {
      code,
      name: data.name.trim(),
      type: data.type,
      defaultDebitAccountId: data.defaultDebitAccountId || null,
      defaultCreditAccountId: data.defaultCreditAccountId || null,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    },
    include: {
      defaultDebitAccount: true,
      defaultCreditAccount: true,
    },
  });

  return journal;
}

async function updateJournal(id, data) {
  await getJournalById(id);

  if (data.code) {
    const code = data.code.trim().toUpperCase();
    const existing = await prisma.journal.findFirst({
      where: {
        code,
        NOT: { id },
      },
    });
    if (existing) {
      const error = new Error(`A journal with code '${code}' already exists.`);
      error.statusCode = 409;
      throw error;
    }
  }

  if (data.defaultDebitAccountId) {
    const acc = await prisma.account.findUnique({ where: { id: data.defaultDebitAccountId } });
    if (!acc) {
      const error = new Error(`Debit account with ID '${data.defaultDebitAccountId}' does not exist.`);
      error.statusCode = 400;
      throw error;
    }
  }

  if (data.defaultCreditAccountId) {
    const acc = await prisma.account.findUnique({ where: { id: data.defaultCreditAccountId } });
    if (!acc) {
      const error = new Error(`Credit account with ID '${data.defaultCreditAccountId}' does not exist.`);
      error.statusCode = 400;
      throw error;
    }
  }

  const updatePayload = {};
  if (data.code !== undefined) updatePayload.code = data.code.trim().toUpperCase();
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.type !== undefined) updatePayload.type = data.type;
  if (data.defaultDebitAccountId !== undefined) updatePayload.defaultDebitAccountId = data.defaultDebitAccountId || null;
  if (data.defaultCreditAccountId !== undefined) updatePayload.defaultCreditAccountId = data.defaultCreditAccountId || null;
  if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);

  const journal = await prisma.journal.update({
    where: { id },
    data: updatePayload,
    include: {
      defaultDebitAccount: true,
      defaultCreditAccount: true,
    },
  });

  return journal;
}

async function deleteJournal(id) {
  await getJournalById(id);

  const [entriesCount, paymentsCount, invoicesCount, billsCount] = await Promise.all([
    prisma.journalEntry.count({ where: { journalId: id } }),
    prisma.payment.count({ where: { journalId: id } }),
    prisma.customerInvoice.count({ where: { journalId: id } }),
    prisma.vendorBill.count({ where: { journalId: id } }),
  ]);

  if (entriesCount > 0 || paymentsCount > 0 || invoicesCount > 0 || billsCount > 0) {
    const archived = await prisma.journal.update({
      where: { id },
      data: { isActive: false },
    });
    return { journal: archived, archived: true, message: 'Journal has posted transactions and was archived.' };
  }

  const deleted = await prisma.journal.delete({
    where: { id },
  });

  return { journal: deleted, archived: false, message: 'Journal deleted successfully.' };
}

module.exports = {
  getAllJournals,
  getJournalById,
  createJournal,
  updateJournal,
  deleteJournal,
};
