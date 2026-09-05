const { prisma } = require('../config/db');
const { generateSequenceNumber } = require('../utils/sequence');

function round2(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

/**
 * Creates a balanced double-entry Journal Entry with items and updates account balances.
 * Must balance: sum(debit) === sum(credit) > 0.
 *
 * @param {object} tx - Prisma transaction client (or null to create a new one)
 * @param {object} params
 * @param {string} params.journalId - Target Journal ID
 * @param {string} [params.entryNumber] - Sequence number (auto-generated if omitted)
 * @param {Date|string} [params.date] - Date of the transaction
 * @param {string} [params.reference] - Document reference (e.g. INV-2026-0001)
 * @param {string} [params.invoiceId] - Linked CustomerInvoice ID
 * @param {string} [params.billId] - Linked VendorBill ID
 * @param {string} [params.paymentId] - Linked Payment ID
 * @param {Array} params.items - Array of { accountId, label, debit, credit, contactId, analyticAccountId }
 */
async function createBalancedJournalEntry(tx, params) {
  const runner = async (db) => {
    const {
      journalId,
      entryNumber = generateSequenceNumber('JE'),
      date = new Date(),
      reference,
      invoiceId,
      billId,
      paymentId,
      items = [],
    } = params;

    if (!journalId) {
      throw new Error('Journal ID is required for journal entry generation.');
    }

    if (!items || items.length < 2) {
      throw new Error('A balanced journal entry requires at least 2 journal items.');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    const validatedItems = [];

    for (const item of items) {
      if (!item.accountId) {
        throw new Error('Account ID is required for each journal item.');
      }

      const debit = round2(item.debit || 0);
      const credit = round2(item.credit || 0);

      if (debit < 0 || credit < 0) {
        throw new Error('Journal item debit and credit amounts must be non-negative.');
      }

      if (debit === 0 && credit === 0) {
        throw new Error('Journal item must have either debit or credit amount greater than 0.');
      }

      totalDebit = round2(totalDebit + debit);
      totalCredit = round2(totalCredit + credit);

      validatedItems.push({
        accountId: item.accountId,
        label: item.label || reference || null,
        debit,
        credit,
        contactId: item.contactId || item.partnerId || null,
        analyticAccountId: item.analyticAccountId || null,
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
      });
    }

    if (totalDebit <= 0 || totalCredit <= 0) {
      throw new Error('Journal entry totals must be greater than zero.');
    }

    if (totalDebit !== totalCredit) {
      throw new Error(
        `Unbalanced journal entry rejected: Total Debit (${totalDebit.toFixed(2)}) must equal Total Credit (${totalCredit.toFixed(2)}).`
      );
    }

    // Verify journal exists
    const journal = await db.journal.findUnique({
      where: { id: journalId },
    });
    if (!journal) {
      throw new Error(`Journal with ID ${journalId} not found.`);
    }

    // Create journal entry record
    const entry = await db.journalEntry.create({
      data: {
        entryNumber,
        date: new Date(date),
        reference,
        journalId,
        status: 'POSTED',
        postedAt: new Date(),
        totalDebit,
        totalCredit,
        invoiceId: invoiceId || null,
        billId: billId || null,
        paymentId: paymentId || null,
        items: {
          create: validatedItems.map((item) => ({
            accountId: item.accountId,
            contactId: item.contactId,
            analyticAccountId: item.analyticAccountId,
            label: item.label,
            debit: item.debit,
            credit: item.credit,
            dueDate: item.dueDate,
          })),
        },
      },
      include: {
        items: {
          include: {
            account: true,
            contact: true,
            analyticAccount: true,
          },
        },
        journal: true,
      },
    });

    // Update account balances according to normal debit/credit rules
    for (const item of validatedItems) {
      const account = await db.account.findUnique({
        where: { id: item.accountId },
      });

      if (!account) {
        throw new Error(`Account with ID ${item.accountId} not found.`);
      }

      let balanceDelta = 0;
      if (['ASSET', 'EXPENSE'].includes(account.type)) {
        balanceDelta = round2(item.debit - item.credit);
      } else {
        // LIABILITY, EQUITY, REVENUE have normal credit balances
        balanceDelta = round2(item.credit - item.debit);
      }

      await db.account.update({
        where: { id: item.accountId },
        data: {
          currentBalance: {
            increment: balanceDelta,
          },
        },
      });
    }

    return entry;
  };

  if (tx) {
    return runner(tx);
  }
  return prisma.$transaction(runner);
}

/**
 * Helper to get a journal by code (e.g. 'INV', 'BILL', 'BNK', 'CSH')
 */
async function getJournalByCode(code, tx = null) {
  const db = tx || prisma;
  const journal = await db.journal.findUnique({
    where: { code },
    include: {
      defaultDebitAccount: true,
      defaultCreditAccount: true,
    },
  });
  if (!journal) {
    throw new Error(`Required system journal '${code}' not found.`);
  }
  return journal;
}

/**
 * Helper to get an account by code (e.g. '101000', '102000', '103000', '201000', '401000', '501000')
 */
async function getAccountByCode(code, tx = null) {
  const db = tx || prisma;
  const account = await db.account.findUnique({
    where: { code },
  });
  if (!account) {
    throw new Error(`Required system account with code '${code}' not found.`);
  }
  return account;
}

/**
 * Query journal entries
 */
async function getJournalEntries(query = {}) {
  const { journalId, status, search, invoiceId, billId, paymentId } = query;
  const where = {};

  if (journalId) where.journalId = journalId;
  if (status) where.status = status;
  if (invoiceId) where.invoiceId = invoiceId;
  if (billId) where.billId = billId;
  if (paymentId) where.paymentId = paymentId;

  if (search) {
    where.OR = [
      { entryNumber: { contains: search, mode: 'insensitive' } },
      { reference: { contains: search, mode: 'insensitive' } },
    ];
  }

  return prisma.journalEntry.findMany({
    where,
    include: {
      journal: true,
      items: {
        include: {
          account: true,
          contact: true,
          analyticAccount: true,
        },
      },
    },
    orderBy: { date: 'desc' },
  });
}

/**
 * Get single journal entry by ID
 */
async function getJournalEntryById(id) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      journal: true,
      items: {
        include: {
          account: true,
          contact: true,
          analyticAccount: true,
        },
      },
    },
  });
  if (!entry) {
    throw new Error(`Journal entry with ID ${id} not found.`);
  }
  return entry;
}

module.exports = {
  createBalancedJournalEntry,
  getJournalByCode,
  getAccountByCode,
  getJournalEntries,
  getJournalEntryById,
  round2,
};
