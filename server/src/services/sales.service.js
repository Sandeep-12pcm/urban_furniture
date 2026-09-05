const { prisma } = require('../config/db');
const { generateSequenceNumber } = require('../utils/sequence');
const { round2, getJournalByCode, getAccountByCode } = require('./accounting.service');

function calculateSalesOrderTotals(items) {
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
      productId: item.productId,
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
 * Create a new Sales Order
 */
async function createSalesOrder(data) {
  const { customerId, commitmentDate, notes, items, status = 'DRAFT' } = data;

  const customer = await prisma.contact.findUnique({
    where: { id: customerId },
  });
  if (!customer) {
    throw new Error(`Customer with ID ${customerId} not found.`);
  }
  if (!['CUSTOMER', 'BOTH'].includes(customer.type)) {
    throw new Error(`Contact '${customer.name}' is not marked as a CUSTOMER.`);
  }

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
    });
    if (!product) {
      throw new Error(`Product with ID ${item.productId} not found.`);
    }
  }

  const { processedItems, untaxedAmount, taxAmount, totalAmount } = calculateSalesOrderTotals(items);
  const orderNumber = data.orderNumber || generateSequenceNumber('SO');

  return prisma.salesOrder.create({
    data: {
      orderNumber,
      customerId,
      commitmentDate: commitmentDate ? new Date(commitmentDate) : null,
      notes: notes || null,
      status,
      untaxedAmount,
      taxAmount,
      totalAmount,
      items: {
        create: processedItems,
      },
    },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
      customerInvoices: true,
    },
  });
}

/**
 * List Sales Orders with filters
 */
async function getSalesOrders(query = {}) {
  const { status, customerId, search } = query;
  const where = {};

  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  return prisma.salesOrder.findMany({
    where,
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
      customerInvoices: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get single Sales Order by ID
 */
async function getSalesOrderById(id) {
  const so = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
      customerInvoices: true,
    },
  });
  if (!so) {
    throw new Error(`Sales Order with ID ${id} not found.`);
  }
  return so;
}

/**
 * Update a Sales Order
 */
async function updateSalesOrder(id, data) {
  const existing = await getSalesOrderById(id);

  if (existing.status === 'CANCELLED') {
    throw new Error('Cannot modify a cancelled sales order.');
  }

  if (existing.customerInvoices && existing.customerInvoices.length > 0) {
    throw new Error('Cannot modify sales order that has already been converted to customer invoice(s).');
  }

  if (data.status && data.status !== existing.status) {
    const validTransitions = {
      DRAFT: ['SENT', 'CONFIRMED', 'CANCELLED'],
      SENT: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['CANCELLED'],
      CANCELLED: [],
    };

    const allowed = validTransitions[existing.status] || [];
    if (!allowed.includes(data.status)) {
      throw new Error(`Invalid status transition from ${existing.status} to ${data.status}.`);
    }
  }

  return prisma.$transaction(async (tx) => {
    let updateData = {};

    if (data.customerId) {
      const customer = await tx.contact.findUnique({ where: { id: data.customerId } });
      if (!customer) throw new Error(`Customer with ID ${data.customerId} not found.`);
      if (!['CUSTOMER', 'BOTH'].includes(customer.type)) {
        throw new Error(`Contact '${customer.name}' is not marked as a CUSTOMER.`);
      }
      updateData.customerId = data.customerId;
    }

    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status) updateData.status = data.status;
    if (data.commitmentDate !== undefined) {
      updateData.commitmentDate = data.commitmentDate ? new Date(data.commitmentDate) : null;
    }

    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (!prod) throw new Error(`Product with ID ${item.productId} not found.`);
      }

      const { processedItems, untaxedAmount, taxAmount, totalAmount } = calculateSalesOrderTotals(data.items);
      updateData.untaxedAmount = untaxedAmount;
      updateData.taxAmount = taxAmount;
      updateData.totalAmount = totalAmount;

      await tx.salesOrderItem.deleteMany({
        where: { salesOrderId: id },
      });

      updateData.items = {
        create: processedItems,
      };
    }

    return tx.salesOrder.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        customerInvoices: true,
      },
    });
  });
}

/**
 * Convert a confirmed Sales Order into a Customer Invoice
 */
async function convertSOToInvoice(id, invoiceData = {}) {
  const so = await getSalesOrderById(id);

  if (so.status !== 'CONFIRMED') {
    throw new Error(`Sales order must be in CONFIRMED status to convert to invoice. Current status: ${so.status}.`);
  }

  return prisma.$transaction(async (tx) => {
    let invoiceJournal;
    try {
      invoiceJournal = await getJournalByCode('INV', tx);
    } catch {
      invoiceJournal = await tx.journal.findFirst({
        where: { type: 'SALE' },
      });
    }

    let defaultRevenueAccount;
    try {
      defaultRevenueAccount = await getAccountByCode('401000', tx);
    } catch {
      defaultRevenueAccount = await tx.account.findFirst({
        where: { type: 'REVENUE' },
      });
    }

    const invoiceNumber = invoiceData.invoiceNumber || generateSequenceNumber('INV');
    const invoiceDate = invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate) : new Date();
    const dueDate = invoiceData.dueDate
      ? new Date(invoiceData.dueDate)
      : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days payment terms

    const invoiceItems = [];
    for (const item of so.items) {
      const revenueAccountId = item.product.salesAccountId || defaultRevenueAccount?.id || null;
      invoiceItems.push({
        productId: item.productId,
        accountId: revenueAccountId,
        description: item.description || `Sale of ${item.product.name}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        subtotal: item.subtotal,
      });
    }

    const customerInvoice = await tx.customerInvoice.create({
      data: {
        invoiceNumber,
        customerId: so.customerId,
        salesOrderId: so.id,
        journalId: invoiceJournal?.id || null,
        invoiceDate,
        dueDate,
        reference: invoiceData.reference || so.orderNumber,
        status: 'DRAFT',
        untaxedAmount: so.untaxedAmount,
        taxAmount: so.taxAmount,
        totalAmount: so.totalAmount,
        amountDue: so.totalAmount,
        items: {
          create: invoiceItems,
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
      },
    });

    return customerInvoice;
  });
}

module.exports = {
  calculateSalesOrderTotals,
  createSalesOrder,
  getSalesOrders,
  getSalesOrderById,
  updateSalesOrder,
  convertSOToInvoice,
};
