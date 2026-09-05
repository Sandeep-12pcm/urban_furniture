const { prisma } = require('../config/db');
const { generateSequenceNumber } = require('../utils/sequence');
const {
  round2,
  createBalancedJournalEntry,
  getJournalByCode,
  getAccountByCode,
} = require('./accounting.service');

function calculateInvoiceTotals(items) {
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

function enrichInvoiceWithAmountPaid(invoice) {
  if (!invoice) return null;
  const total = Number(invoice.totalAmount);
  const due = Number(invoice.amountDue);
  return {
    ...invoice,
    amountPaid: round2(total - due),
  };
}

/**
 * Create a Customer Invoice
 */
async function createInvoice(data) {
  const {
    customerId,
    salesOrderId,
    invoiceDate = new Date(),
    dueDate,
    reference,
    items,
    status = 'DRAFT',
    autoPost = false,
  } = data;

  const customer = await prisma.contact.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw new Error(`Customer with ID ${customerId} not found.`);
  }
  if (!['CUSTOMER', 'BOTH'].includes(customer.type)) {
    throw new Error(`Contact '${customer.name}' is not marked as a CUSTOMER.`);
  }

  let invoiceJournal;
  try {
    invoiceJournal = await getJournalByCode('INV');
  } catch {
    invoiceJournal = await prisma.journal.findFirst({ where: { type: 'SALE' } });
  }

  let defaultRevenueAccount;
  try {
    defaultRevenueAccount = await getAccountByCode('401000');
  } catch {
    defaultRevenueAccount = await prisma.account.findFirst({ where: { type: 'REVENUE' } });
  }

  let defaultReceivableAccount;
  try {
    defaultReceivableAccount = await getAccountByCode('103000');
  } catch {
    defaultReceivableAccount = await prisma.account.findFirst({ where: { type: 'ASSET' } });
  }

  const { processedItems, untaxedAmount, taxAmount, totalAmount } = calculateInvoiceTotals(items);

  // Fill default accounts for items if missing
  for (const item of processedItems) {
    if (!item.accountId) {
      if (item.productId) {
        const prod = await prisma.product.findUnique({ where: { id: item.productId } });
        item.accountId = prod?.salesAccountId || defaultRevenueAccount?.id;
      } else {
        item.accountId = defaultRevenueAccount?.id;
      }
    }
  }

  const invoiceNumber = data.invoiceNumber || generateSequenceNumber('INV');
  const shouldPost = status === 'POSTED' || autoPost === true;

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.customerInvoice.create({
      data: {
        invoiceNumber,
        customerId,
        salesOrderId: salesOrderId || null,
        journalId: invoiceJournal?.id || null,
        invoiceDate: new Date(invoiceDate),
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
        customer: true,
        items: {
          include: {
            product: true,
            account: true,
          },
        },
        salesOrder: true,
        payments: true,
      },
    });

    if (shouldPost) {
      // Create double-entry journal entry:
      // Debit: Accounts Receivable (totalAmount)
      // Credit: Sales Revenue (items subtotal + tax)
      const journalItems = [];

      journalItems.push({
        accountId: defaultReceivableAccount.id,
        label: `Customer Receivable for ${invoice.invoiceNumber}`,
        debit: Number(invoice.totalAmount),
        credit: 0,
        contactId: invoice.customerId,
        dueDate: invoice.dueDate,
      });

      for (const item of invoice.items) {
        journalItems.push({
          accountId: item.accountId || defaultRevenueAccount.id,
          label: item.description || `Sale item ${invoice.invoiceNumber}`,
          debit: 0,
          credit: Number(item.subtotal),
          contactId: invoice.customerId,
          analyticAccountId: item.analyticAccountId,
        });
      }

      if (Number(invoice.taxAmount) > 0) {
        journalItems.push({
          accountId: defaultRevenueAccount.id,
          label: `Tax on ${invoice.invoiceNumber}`,
          debit: 0,
          credit: Number(invoice.taxAmount),
          contactId: invoice.customerId,
        });
      }

      await createBalancedJournalEntry(tx, {
        journalId: invoice.journalId || invoiceJournal.id,
        reference: invoice.invoiceNumber,
        invoiceId: invoice.id,
        date: invoice.invoiceDate,
        items: journalItems,
      });
    }

    return enrichInvoiceWithAmountPaid(invoice);
  });
}

/**
 * List Customer Invoices
 */
async function getInvoices(query = {}) {
  const { status, customerId, search } = query;
  const where = {};

  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { reference: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const invoices = await prisma.customerInvoice.findMany({
    where,
    include: {
      customer: true,
      items: {
        include: {
          product: true,
          account: true,
        },
      },
      salesOrder: true,
      payments: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return invoices.map(enrichInvoiceWithAmountPaid);
}

/**
 * Get Invoice by ID
 */
async function getInvoiceById(id) {
  const invoice = await prisma.customerInvoice.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
          account: true,
          analyticAccount: true,
        },
      },
      salesOrder: true,
      payments: true,
    },
  });
  if (!invoice) {
    throw new Error(`Customer Invoice with ID ${id} not found.`);
  }
  return enrichInvoiceWithAmountPaid(invoice);
}

/**
 * Post a Draft Invoice
 */
async function postInvoice(id) {
  const invoice = await getInvoiceById(id);

  if (invoice.status !== 'DRAFT') {
    throw new Error(`Only DRAFT invoices can be posted. Current status: ${invoice.status}.`);
  }

  return prisma.$transaction(async (tx) => {
    let invoiceJournal;
    try {
      invoiceJournal = await getJournalByCode('INV', tx);
    } catch {
      invoiceJournal = await tx.journal.findFirst({ where: { type: 'SALE' } });
    }

    let defaultRevenueAccount;
    try {
      defaultRevenueAccount = await getAccountByCode('401000', tx);
    } catch {
      defaultRevenueAccount = await tx.account.findFirst({ where: { type: 'REVENUE' } });
    }

    let defaultReceivableAccount;
    try {
      defaultReceivableAccount = await getAccountByCode('103000', tx);
    } catch {
      defaultReceivableAccount = await tx.account.findFirst({ where: { type: 'ASSET' } });
    }

    const journalItems = [];

    journalItems.push({
      accountId: defaultReceivableAccount.id,
      label: `Customer Receivable for ${invoice.invoiceNumber}`,
      debit: Number(invoice.totalAmount),
      credit: 0,
      contactId: invoice.customerId,
      dueDate: invoice.dueDate,
    });

    for (const item of invoice.items) {
      journalItems.push({
        accountId: item.accountId || defaultRevenueAccount.id,
        label: item.description || `Sale item ${invoice.invoiceNumber}`,
        debit: 0,
        credit: Number(item.subtotal),
        contactId: invoice.customerId,
        analyticAccountId: item.analyticAccountId,
      });
    }

    if (Number(invoice.taxAmount) > 0) {
      journalItems.push({
        accountId: defaultRevenueAccount.id,
        label: `Tax on ${invoice.invoiceNumber}`,
        debit: 0,
        credit: Number(invoice.taxAmount),
        contactId: invoice.customerId,
      });
    }

    await createBalancedJournalEntry(tx, {
      journalId: invoice.journalId || invoiceJournal.id,
      reference: invoice.invoiceNumber,
      invoiceId: invoice.id,
      date: invoice.invoiceDate,
      items: journalItems,
    });

    const updated = await tx.customerInvoice.update({
      where: { id },
      data: { status: 'POSTED' },
      include: {
        customer: true,
        items: true,
        payments: true,
      },
    });

    return enrichInvoiceWithAmountPaid(updated);
  });
}

/**
 * Register Payment directly against a Customer Invoice
 */
async function registerInvoicePayment(id, paymentData) {
  const invoice = await getInvoiceById(id);

  if (!['POSTED', 'PARTIALLY_PAID'].includes(invoice.status)) {
    throw new Error(
      `Cannot register payment for invoice with status '${invoice.status}'. Invoice must be POSTED or PARTIALLY_PAID.`
    );
  }

  const payAmount = round2(Number(paymentData.amount));
  const currentDue = round2(Number(invoice.amountDue));

  if (payAmount <= 0) {
    throw new Error('Payment amount must be greater than 0.');
  }

  if (payAmount > currentDue) {
    throw new Error(
      `Payment amount (${payAmount.toFixed(2)}) cannot exceed outstanding amount (${currentDue.toFixed(2)}).`
    );
  }

  const method = (paymentData.paymentMethod || 'BANK').toUpperCase();

  return prisma.$transaction(async (tx) => {
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

    const defaultReceivableAccount = await getAccountByCode('103000', tx);

    const paymentNumber = paymentData.paymentNumber || generateSequenceNumber('PAY');
    const paymentDate = paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date();

    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        paymentType: 'INBOUND',
        partnerType: 'CUSTOMER',
        contactId: invoice.customerId,
        amount: payAmount,
        paymentDate,
        paymentMethod: method,
        journalId: paymentJournal?.id || null,
        invoiceId: invoice.id,
        memo: paymentData.memo || `Receipt for Invoice ${invoice.invoiceNumber}`,
        status: 'POSTED',
      },
      include: {
        contact: true,
        journal: true,
      },
    });

    const newAmountDue = round2(currentDue - payAmount);
    const newStatus = newAmountDue === 0 ? 'PAID' : 'PARTIALLY_PAID';

    const updatedInvoice = await tx.customerInvoice.update({
      where: { id },
      data: {
        amountDue: newAmountDue,
        status: newStatus,
      },
    });

    // Create balanced journal entry for receipt:
    // Debit: Cash / Bank (increasing asset)
    // Credit: Accounts Receivable (reducing customer receivable)
    await createBalancedJournalEntry(tx, {
      journalId: paymentJournal?.id,
      reference: payment.paymentNumber,
      invoiceId: invoice.id,
      paymentId: payment.id,
      date: paymentDate,
      items: [
        {
          accountId: paymentAccount.id,
          label: `Receipt via ${method}: ${payment.paymentNumber}`,
          debit: payAmount,
          credit: 0,
          contactId: invoice.customerId,
        },
        {
          accountId: defaultReceivableAccount.id,
          label: `Invoice settlement - Reduce AR: ${invoice.invoiceNumber}`,
          debit: 0,
          credit: payAmount,
          contactId: invoice.customerId,
        },
      ],
    });

    return {
      payment,
      invoice: enrichInvoiceWithAmountPaid(updatedInvoice),
    };
  });
}

module.exports = {
  calculateInvoiceTotals,
  createInvoice,
  getInvoices,
  getInvoiceById,
  postInvoice,
  registerInvoicePayment,
};
