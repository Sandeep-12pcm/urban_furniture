const { prisma } = require('../config/db');
const { generateSequenceNumber } = require('../utils/sequence');
const {
  round2,
  createBalancedJournalEntry,
  getJournalByCode,
  getAccountByCode,
} = require('./accounting.service');

function calculateBillTotals(items) {
  let untaxedAmount = 0;
  let taxAmount = 0;

  const processedItems = items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const taxRate = item.taxRate ? Number(item.taxRate) : 0;

    const subtotal = round2(quantity * unitPrice);
    const itemTax = round2(subtotal * (taxRate / 100));

    untaxedAmount = round2(untaxedAmount + subtotal);
    taxAmount = round2(taxAmount + itemTax);

    return {
      productId: item.productId || null,
      accountId: item.accountId || null,
      analyticAccountId: item.analyticAccountId || null,
      description: item.description || null,
      quantity,
      unitPrice,
      taxRate,
      subtotal,
    };
  });

  const totalAmount = round2(untaxedAmount + taxAmount);

  return {
    processedItems,
    untaxedAmount,
    taxAmount,
    totalAmount,
  };
}

/**
 * Create a Vendor Bill
 */
async function createVendorBill(data) {
  const {
    vendorId,
    purchaseOrderId,
    billDate = new Date(),
    dueDate,
    reference,
    notes,
    items,
    status = 'DRAFT',
    autoPost = false,
  } = data;

  const vendor = await prisma.contact.findUnique({ where: { id: vendorId } });
  if (!vendor) {
    throw new Error(`Vendor with ID ${vendorId} not found.`);
  }
  if (!['VENDOR', 'BOTH'].includes(vendor.type)) {
    throw new Error(`Contact '${vendor.name}' is not marked as a VENDOR.`);
  }

  // Look up default BILL journal and accounts
  let billJournal;
  try {
    billJournal = await getJournalByCode('BILL');
  } catch {
    billJournal = await prisma.journal.findFirst({ where: { type: 'PURCHASE' } });
  }

  let defaultExpenseAccount;
  try {
    defaultExpenseAccount = await getAccountByCode('501000');
  } catch {
    defaultExpenseAccount = await prisma.account.findFirst({ where: { type: 'EXPENSE' } });
  }

  let defaultPayableAccount;
  try {
    defaultPayableAccount = await getAccountByCode('201000');
  } catch {
    defaultPayableAccount = await prisma.account.findFirst({ where: { type: 'LIABILITY' } });
  }

  const { processedItems, untaxedAmount, taxAmount, totalAmount } = calculateBillTotals(items);

  // Fill default accounts for items if missing
  for (const item of processedItems) {
    if (!item.accountId) {
      if (item.productId) {
        const prod = await prisma.product.findUnique({ where: { id: item.productId } });
        item.accountId = prod?.expenseAccountId || defaultExpenseAccount?.id;
      } else {
        item.accountId = defaultExpenseAccount?.id;
      }
    }
  }

  const billNumber = data.billNumber || generateSequenceNumber('BILL');
  const shouldPost = status === 'POSTED' || autoPost === true;

  return prisma.$transaction(async (tx) => {
    const bill = await tx.vendorBill.create({
      data: {
        billNumber,
        vendorId,
        purchaseOrderId: purchaseOrderId || null,
        journalId: billJournal?.id || null,
        billDate: new Date(billDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        reference: reference || null,
        status: shouldPost ? 'POSTED' : 'DRAFT',
        untaxedAmount,
        taxAmount,
        totalAmount,
        amountDue: totalAmount,
        items: {
          create: processedItems,
        },
      },
      include: {
        vendor: true,
        items: {
          include: {
            product: true,
            account: true,
          },
        },
        purchaseOrder: true,
        payments: true,
      },
    });

    if (shouldPost) {
      // Create double-entry journal entry:
      // Debit: Expenses (items + tax)
      // Credit: Accounts Payable (totalAmount)
      const journalItems = [];

      for (const item of bill.items) {
        journalItems.push({
          accountId: item.accountId || defaultExpenseAccount.id,
          label: item.description || `Purchase item ${bill.billNumber}`,
          debit: item.subtotal,
          credit: 0,
          contactId: bill.vendorId,
          analyticAccountId: item.analyticAccountId,
        });
      }

      if (bill.taxAmount > 0) {
        journalItems.push({
          accountId: defaultExpenseAccount.id,
          label: `Tax on ${bill.billNumber}`,
          debit: Number(bill.taxAmount),
          credit: 0,
          contactId: bill.vendorId,
        });
      }

      journalItems.push({
        accountId: defaultPayableAccount.id,
        label: `Vendor obligation for ${bill.billNumber}`,
        debit: 0,
        credit: Number(bill.totalAmount),
        contactId: bill.vendorId,
        dueDate: bill.dueDate,
      });

      await createBalancedJournalEntry(tx, {
        journalId: bill.journalId || billJournal.id,
        reference: bill.billNumber,
        billId: bill.id,
        date: bill.billDate,
        items: journalItems,
      });
    }

    return bill;
  });
}

/**
 * List Vendor Bills
 */
async function getVendorBills(query = {}) {
  const { status, vendorId, search } = query;
  const where = {};

  if (status) where.status = status;
  if (vendorId) where.vendorId = vendorId;
  if (search) {
    where.OR = [
      { billNumber: { contains: search, mode: 'insensitive' } },
      { reference: { contains: search, mode: 'insensitive' } },
      { vendor: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  return prisma.vendorBill.findMany({
    where,
    include: {
      vendor: true,
      items: {
        include: {
          product: true,
          account: true,
        },
      },
      purchaseOrder: true,
      payments: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get Vendor Bill by ID
 */
async function getVendorBillById(id) {
  const bill = await prisma.vendorBill.findUnique({
    where: { id },
    include: {
      vendor: true,
      items: {
        include: {
          product: true,
          account: true,
          analyticAccount: true,
        },
      },
      purchaseOrder: true,
      payments: true,
    },
  });
  if (!bill) {
    throw new Error(`Vendor Bill with ID ${id} not found.`);
  }
  return bill;
}

/**
 * Post a Draft Vendor Bill
 */
async function postVendorBill(id) {
  const bill = await getVendorBillById(id);

  if (bill.status !== 'DRAFT') {
    throw new Error(`Only DRAFT bills can be posted. Current status: ${bill.status}.`);
  }

  return prisma.$transaction(async (tx) => {
    let billJournal;
    try {
      billJournal = await getJournalByCode('BILL', tx);
    } catch {
      billJournal = await tx.journal.findFirst({ where: { type: 'PURCHASE' } });
    }

    let defaultExpenseAccount;
    try {
      defaultExpenseAccount = await getAccountByCode('501000', tx);
    } catch {
      defaultExpenseAccount = await tx.account.findFirst({ where: { type: 'EXPENSE' } });
    }

    let defaultPayableAccount;
    try {
      defaultPayableAccount = await getAccountByCode('201000', tx);
    } catch {
      defaultPayableAccount = await tx.account.findFirst({ where: { type: 'LIABILITY' } });
    }

    const journalItems = [];

    for (const item of bill.items) {
      journalItems.push({
        accountId: item.accountId || defaultExpenseAccount.id,
        label: item.description || `Purchase item ${bill.billNumber}`,
        debit: Number(item.subtotal),
        credit: 0,
        contactId: bill.vendorId,
        analyticAccountId: item.analyticAccountId,
      });
    }

    if (Number(bill.taxAmount) > 0) {
      journalItems.push({
        accountId: defaultExpenseAccount.id,
        label: `Tax on ${bill.billNumber}`,
        debit: Number(bill.taxAmount),
        credit: 0,
        contactId: bill.vendorId,
      });
    }

    journalItems.push({
      accountId: defaultPayableAccount.id,
      label: `Vendor obligation for ${bill.billNumber}`,
      debit: 0,
      credit: Number(bill.totalAmount),
      contactId: bill.vendorId,
      dueDate: bill.dueDate,
    });

    await createBalancedJournalEntry(tx, {
      journalId: bill.journalId || billJournal.id,
      reference: bill.billNumber,
      billId: bill.id,
      date: bill.billDate,
      items: journalItems,
    });

    return tx.vendorBill.update({
      where: { id },
      data: { status: 'POSTED' },
      include: {
        vendor: true,
        items: true,
        payments: true,
      },
    });
  });
}

/**
 * Register Payment directly against a Vendor Bill
 */
async function registerBillPayment(id, paymentData) {
  const bill = await getVendorBillById(id);

  if (!['POSTED', 'PARTIALLY_PAID'].includes(bill.status)) {
    throw new Error(`Cannot register payment for bill with status '${bill.status}'. Bill must be POSTED or PARTIALLY_PAID.`);
  }

  const payAmount = round2(Number(paymentData.amount));
  const currentDue = round2(Number(bill.amountDue));

  if (payAmount <= 0) {
    throw new Error('Payment amount must be greater than 0.');
  }

  if (payAmount > currentDue) {
    throw new Error(`Payment amount (${payAmount.toFixed(2)}) cannot exceed outstanding amount (${currentDue.toFixed(2)}).`);
  }

  const method = (paymentData.paymentMethod || 'BANK').toUpperCase();

  return prisma.$transaction(async (tx) => {
    // Determine payment journal and account
    let paymentJournal;
    let paymentAccount;

    if (method === 'CASH') {
      try {
        paymentJournal = await getJournalByCode('CSH', tx);
        paymentAccount = await getAccountByCode('101000', tx);
      } catch {
        paymentJournal = await tx.journal.findFirst({ where: { type: 'CASH' } });
        paymentAccount = await tx.account.findFirst({ where: { code: '101000' } });
      }
    } else {
      try {
        paymentJournal = await getJournalByCode('BNK', tx);
        paymentAccount = await getAccountByCode('102000', tx);
      } catch {
        paymentJournal = await tx.journal.findFirst({ where: { type: 'BANK' } });
        paymentAccount = await tx.account.findFirst({ where: { code: '102000' } });
      }
    }

    const defaultPayableAccount = await getAccountByCode('201000', tx);

    const paymentNumber = paymentData.paymentNumber || generateSequenceNumber('PAY');
    const paymentDate = paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date();

    // Create payment record
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        paymentType: 'OUTBOUND',
        partnerType: 'VENDOR',
        contactId: bill.vendorId,
        amount: payAmount,
        paymentDate,
        paymentMethod: method,
        journalId: paymentJournal?.id || null,
        billId: bill.id,
        memo: paymentData.memo || `Payment for Bill ${bill.billNumber}`,
        status: 'POSTED',
      },
      include: {
        contact: true,
        journal: true,
      },
    });

    // Update bill amount due and status
    const newAmountDue = round2(currentDue - payAmount);
    const newStatus = newAmountDue === 0 ? 'PAID' : 'PARTIALLY_PAID';

    const updatedBill = await tx.vendorBill.update({
      where: { id },
      data: {
        amountDue: newAmountDue,
        status: newStatus,
      },
    });

    // Create balanced journal entry for payment:
    // Debit: Accounts Payable (reducing creditor liability)
    // Credit: Cash / Bank (reducing asset)
    await createBalancedJournalEntry(tx, {
      journalId: paymentJournal?.id,
      reference: payment.paymentNumber,
      billId: bill.id,
      paymentId: payment.id,
      date: paymentDate,
      items: [
        {
          accountId: defaultPayableAccount.id,
          label: `Bill payment - Reduce AP: ${bill.billNumber}`,
          debit: payAmount,
          credit: 0,
          contactId: bill.vendorId,
        },
        {
          accountId: paymentAccount.id,
          label: `Disbursement via ${method}: ${payment.paymentNumber}`,
          debit: 0,
          credit: payAmount,
          contactId: bill.vendorId,
        },
      ],
    });

    return {
      payment,
      bill: updatedBill,
    };
  });
}

module.exports = {
  calculateBillTotals,
  createVendorBill,
  getVendorBills,
  getVendorBillById,
  postVendorBill,
  registerBillPayment,
};
