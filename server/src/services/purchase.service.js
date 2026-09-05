const { prisma } = require('../config/db');
const { generateSequenceNumber } = require('../utils/sequence');
const { round2, createBalancedJournalEntry, getJournalByCode, getAccountByCode } = require('./accounting.service');

/**
 * Calculate totals strictly server-side
 */
function calculateOrderTotals(items) {
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
 * Create a new Purchase Order
 */
async function createPurchaseOrder(data) {
  const { vendorId, expectedDate, notes, items, status = 'DRAFT' } = data;

  // Validate vendor exists and can supply goods
  const vendor = await prisma.contact.findUnique({
    where: { id: vendorId },
  });
  if (!vendor) {
    throw new Error(`Vendor with ID ${vendorId} not found.`);
  }
  if (!['VENDOR', 'BOTH'].includes(vendor.type)) {
    throw new Error(`Contact '${vendor.name}' is not marked as a VENDOR.`);
  }

  // Validate all products exist
  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
    });
    if (!product) {
      throw new Error(`Product with ID ${item.productId} not found.`);
    }
  }

  const { processedItems, untaxedAmount, taxAmount, totalAmount } = calculateOrderTotals(items);
  const orderNumber = data.orderNumber || generateSequenceNumber('PO');

  return prisma.purchaseOrder.create({
    data: {
      orderNumber,
      vendorId,
      expectedDate: expectedDate ? new Date(expectedDate) : null,
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
      vendor: true,
      items: {
        include: {
          product: true,
        },
      },
      vendorBills: true,
    },
  });
}

/**
 * List Purchase Orders with filters
 */
async function getPurchaseOrders(query = {}) {
  const { status, vendorId, search } = query;
  const where = {};

  if (status) where.status = status;
  if (vendorId) where.vendorId = vendorId;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { vendor: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  return prisma.purchaseOrder.findMany({
    where,
    include: {
      vendor: true,
      items: {
        include: {
          product: true,
        },
      },
      vendorBills: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get single Purchase Order by ID
 */
async function getPurchaseOrderById(id) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: true,
      items: {
        include: {
          product: true,
        },
      },
      vendorBills: true,
    },
  });
  if (!po) {
    throw new Error(`Purchase Order with ID ${id} not found.`);
  }
  return po;
}

/**
 * Update a Purchase Order
 */
async function updatePurchaseOrder(id, data) {
  const existing = await getPurchaseOrderById(id);

  if (existing.status === 'CANCELLED') {
    throw new Error('Cannot modify a cancelled purchase order.');
  }

  if (existing.vendorBills && existing.vendorBills.length > 0) {
    throw new Error('Cannot modify purchase order that has already been converted to vendor bill(s).');
  }

  // Allowed status transitions
  if (data.status && data.status !== existing.status) {
    const validTransitions = {
      DRAFT: ['SENT', 'CONFIRMED', 'CANCELLED'],
      SENT: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['CANCELLED'], // once confirmed, can only cancel if no bills
      CANCELLED: [],
    };

    const allowed = validTransitions[existing.status] || [];
    if (!allowed.includes(data.status)) {
      throw new Error(`Invalid status transition from ${existing.status} to ${data.status}.`);
    }
  }

  return prisma.$transaction(async (tx) => {
    let updateData = {};

    if (data.vendorId) {
      const vendor = await tx.contact.findUnique({ where: { id: data.vendorId } });
      if (!vendor) throw new Error(`Vendor with ID ${data.vendorId} not found.`);
      if (!['VENDOR', 'BOTH'].includes(vendor.type)) {
        throw new Error(`Contact '${vendor.name}' is not marked as a VENDOR.`);
      }
      updateData.vendorId = data.vendorId;
    }

    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status) updateData.status = data.status;
    if (data.expectedDate !== undefined) {
      updateData.expectedDate = data.expectedDate ? new Date(data.expectedDate) : null;
    }

    if (data.items && Array.isArray(data.items)) {
      // Validate products
      for (const item of data.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (!prod) throw new Error(`Product with ID ${item.productId} not found.`);
      }

      const { processedItems, untaxedAmount, taxAmount, totalAmount } = calculateOrderTotals(data.items);
      updateData.untaxedAmount = untaxedAmount;
      updateData.taxAmount = taxAmount;
      updateData.totalAmount = totalAmount;

      // Delete existing items and create new ones
      await tx.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: id },
      });

      updateData.items = {
        create: processedItems,
      };
    }

    return tx.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        vendor: true,
        items: {
          include: {
            product: true,
          },
        },
        vendorBills: true,
      },
    });
  });
}

/**
 * Convert a confirmed Purchase Order into a Vendor Bill
 */
async function convertPOToBill(id, billData = {}) {
  const po = await getPurchaseOrderById(id);

  if (po.status !== 'CONFIRMED') {
    throw new Error(`Purchase order must be in CONFIRMED status to convert to bill. Current status: ${po.status}.`);
  }

  return prisma.$transaction(async (tx) => {
    // Find vendor bill journal ('BILL' or type PURCHASE)
    let billJournal;
    try {
      billJournal = await getJournalByCode('BILL', tx);
    } catch {
      billJournal = await tx.journal.findFirst({
        where: { type: 'PURCHASE' },
      });
    }

    // Default expense account
    let defaultExpenseAccount;
    try {
      defaultExpenseAccount = await getAccountByCode('501000', tx);
    } catch {
      defaultExpenseAccount = await tx.account.findFirst({
        where: { type: 'EXPENSE' },
      });
    }

    const billNumber = billData.billNumber || generateSequenceNumber('BILL');
    const billDate = billData.billDate ? new Date(billData.billDate) : new Date();
    const dueDate = billData.dueDate
      ? new Date(billData.dueDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days credit

    // Map items from PO
    const billItems = [];
    for (const item of po.items) {
      const expenseAccountId = item.product.expenseAccountId || defaultExpenseAccount?.id || null;
      billItems.push({
        productId: item.productId,
        accountId: expenseAccountId,
        description: item.description || `Purchase of ${item.product.name}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        subtotal: item.subtotal,
      });
    }

    // Create Vendor Bill
    const vendorBill = await tx.vendorBill.create({
      data: {
        billNumber,
        vendorId: po.vendorId,
        purchaseOrderId: po.id,
        journalId: billJournal?.id || null,
        billDate,
        dueDate,
        reference: billData.reference || po.orderNumber,
        status: 'DRAFT',
        untaxedAmount: po.untaxedAmount,
        taxAmount: po.taxAmount,
        totalAmount: po.totalAmount,
        amountDue: po.totalAmount,
        items: {
          create: billItems,
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
      },
    });

    return vendorBill;
  });
}

module.exports = {
  calculateOrderTotals,
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  convertPOToBill,
};
