const { prisma } = require('../config/db');
const { generateSequenceNumber } = require('../utils/sequence');
const {
  round2,
  createBalancedJournalEntry,
  getJournalByCode,
  getAccountByCode,
} = require('./accounting.service');

/**
 * Create a new payment with double-entry journal entry and invoice/bill reconciliation
 */
async function createPayment(data) {
  const {
    invoiceId,
    billId,
    amount,
    paymentMethod = 'BANK',
    paymentDate = new Date(),
    memo,
  } = data;

  const payAmount = round2(Number(amount));
  if (payAmount <= 0) {
    throw new Error('Payment amount must be greater than 0.');
  }

  const method = paymentMethod.toUpperCase();
  if (!['CASH', 'BANK'].includes(method)) {
    throw new Error("Payment method must be 'CASH' or 'BANK'.");
  }

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

    let contactId = data.contactId;
    let paymentType = data.paymentType || 'INBOUND';
    let partnerType = data.partnerType || 'CUSTOMER';
    let linkedInvoice = null;
    let linkedBill = null;

    if (invoiceId) {
      linkedInvoice = await tx.customerInvoice.findUnique({
        where: { id: invoiceId },
        include: { customer: true },
      });
      if (!linkedInvoice) {
        throw new Error(`Customer Invoice with ID ${invoiceId} not found.`);
      }
      if (!['POSTED', 'PARTIALLY_PAID'].includes(linkedInvoice.status)) {
        throw new Error(
          `Cannot pay invoice in '${linkedInvoice.status}' status. Invoice must be POSTED or PARTIALLY_PAID.`
        );
      }

      const due = round2(Number(linkedInvoice.amountDue));
      if (payAmount > due) {
        throw new Error(`Payment amount (${payAmount.toFixed(2)}) cannot exceed invoice amount due (${due.toFixed(2)}).`);
      }

      contactId = linkedInvoice.customerId;
      paymentType = 'INBOUND';
      partnerType = 'CUSTOMER';

      const newDue = round2(due - payAmount);
      const newStatus = newDue === 0 ? 'PAID' : 'PARTIALLY_PAID';

      await tx.customerInvoice.update({
        where: { id: invoiceId },
        data: {
          amountDue: newDue,
          status: newStatus,
        },
      });
    } else if (billId) {
      linkedBill = await tx.vendorBill.findUnique({
        where: { id: billId },
        include: { vendor: true },
      });
      if (!linkedBill) {
        throw new Error(`Vendor Bill with ID ${billId} not found.`);
      }
      if (!['POSTED', 'PARTIALLY_PAID'].includes(linkedBill.status)) {
        throw new Error(
          `Cannot pay bill in '${linkedBill.status}' status. Bill must be POSTED or PARTIALLY_PAID.`
        );
      }

      const due = round2(Number(linkedBill.amountDue));
      if (payAmount > due) {
        throw new Error(`Payment amount (${payAmount.toFixed(2)}) cannot exceed bill amount due (${due.toFixed(2)}).`);
      }

      contactId = linkedBill.vendorId;
      paymentType = 'OUTBOUND';
      partnerType = 'VENDOR';

      const newDue = round2(due - payAmount);
      const newStatus = newDue === 0 ? 'PAID' : 'PARTIALLY_PAID';

      await tx.vendorBill.update({
        where: { id: billId },
        data: {
          amountDue: newDue,
          status: newStatus,
        },
      });
    } else {
      if (!contactId) {
        throw new Error('Contact ID (contactId) is required when no invoice or bill is specified.');
      }
      const contact = await tx.contact.findUnique({ where: { id: contactId } });
      if (!contact) {
        throw new Error(`Contact with ID ${contactId} not found.`);
      }
      partnerType = ['VENDOR', 'BOTH'].includes(contact.type) && paymentType === 'OUTBOUND' ? 'VENDOR' : 'CUSTOMER';
    }

    const paymentNumber = data.paymentNumber || generateSequenceNumber('PAY');
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        paymentType,
        partnerType,
        contactId,
        amount: payAmount,
        paymentDate: new Date(paymentDate),
        paymentMethod: method,
        journalId: paymentJournal?.id || null,
        invoiceId: invoiceId || null,
        billId: billId || null,
        memo: memo || (invoiceId ? `Receipt for invoice` : billId ? `Disbursement for bill` : 'Payment'),
        status: 'POSTED',
      },
      include: {
        contact: true,
        journal: true,
        invoice: true,
        bill: true,
      },
    });

    // Double-Entry Accounting
    if (paymentType === 'INBOUND') {
      // Customer payment received:
      // Debit: Cash / Bank (asset increases)
      // Credit: Accounts Receivable (debtor asset decreases)
      const arAccount = await getAccountByCode('103000', tx);
      await createBalancedJournalEntry(tx, {
        journalId: paymentJournal?.id,
        reference: payment.paymentNumber,
        paymentId: payment.id,
        invoiceId: invoiceId || null,
        date: payment.paymentDate,
        items: [
          {
            accountId: paymentAccount.id,
            label: `Inbound receipt via ${method} (${payment.paymentNumber})`,
            debit: payAmount,
            credit: 0,
            contactId,
          },
          {
            accountId: arAccount.id,
            label: `Settle customer receivable (${payment.paymentNumber})`,
            debit: 0,
            credit: payAmount,
            contactId,
          },
        ],
      });
    } else {
      // Vendor payment made:
      // Debit: Accounts Payable (creditor liability decreases)
      // Credit: Cash / Bank (asset decreases)
      const apAccount = await getAccountByCode('201000', tx);
      await createBalancedJournalEntry(tx, {
        journalId: paymentJournal?.id,
        reference: payment.paymentNumber,
        paymentId: payment.id,
        billId: billId || null,
        date: payment.paymentDate,
        items: [
          {
            accountId: apAccount.id,
            label: `Settle vendor payable (${payment.paymentNumber})`,
            debit: payAmount,
            credit: 0,
            contactId,
          },
          {
            accountId: paymentAccount.id,
            label: `Outbound disbursement via ${method} (${payment.paymentNumber})`,
            debit: 0,
            credit: payAmount,
            contactId,
          },
        ],
      });
    }

    return payment;
  });
}

/**
 * List Payments
 */
async function getPayments(query = {}) {
  const { paymentType, partnerType, contactId, invoiceId, billId, search } = query;
  const where = {};

  if (paymentType) where.paymentType = paymentType;
  if (partnerType) where.partnerType = partnerType;
  if (contactId) where.contactId = contactId;
  if (invoiceId) where.invoiceId = invoiceId;
  if (billId) where.billId = billId;

  if (search) {
    where.OR = [
      { paymentNumber: { contains: search, mode: 'insensitive' } },
      { memo: { contains: search, mode: 'insensitive' } },
      { contact: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  return prisma.payment.findMany({
    where,
    include: {
      contact: true,
      journal: true,
      invoice: true,
      bill: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get Payment by ID
 */
async function getPaymentById(id) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      contact: true,
      journal: true,
      invoice: true,
      bill: true,
    },
  });
  if (!payment) {
    throw new Error(`Payment with ID ${id} not found.`);
  }
  return payment;
}

module.exports = {
  createPayment,
  getPayments,
  getPaymentById,
};
