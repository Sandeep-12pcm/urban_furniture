const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const purchaseController = require('../controllers/purchase.controller');
const vendorBillController = require('../controllers/vendorBill.controller');
const salesController = require('../controllers/sales.controller');
const invoiceController = require('../controllers/invoice.controller');
const paymentController = require('../controllers/payment.controller');
const journalEntryController = require('../controllers/journalEntry.controller');

// 1. Purchase Orders Router
const purchaseOrderRouter = express.Router();
purchaseOrderRouter.use(authenticate);
purchaseOrderRouter.get('/', purchaseController.getAll);
purchaseOrderRouter.get('/:id', purchaseController.getById);
purchaseOrderRouter.post('/', requireRole('ADMIN', 'ACCOUNTANT'), purchaseController.create);
purchaseOrderRouter.put('/:id', requireRole('ADMIN', 'ACCOUNTANT'), purchaseController.update);
purchaseOrderRouter.post('/:id/convert-to-bill', requireRole('ADMIN', 'ACCOUNTANT'), purchaseController.convertToBill);

// 2. Vendor Bills Router
const vendorBillRouter = express.Router();
vendorBillRouter.use(authenticate);
vendorBillRouter.get('/', vendorBillController.getAll);
vendorBillRouter.get('/:id', vendorBillController.getById);
vendorBillRouter.post('/', requireRole('ADMIN', 'ACCOUNTANT'), vendorBillController.create);
vendorBillRouter.post('/:id/post', requireRole('ADMIN', 'ACCOUNTANT'), vendorBillController.postBill);
vendorBillRouter.post('/:id/payment', requireRole('ADMIN', 'ACCOUNTANT'), vendorBillController.registerPayment);

// 3. Sales Orders Router
const salesOrderRouter = express.Router();
salesOrderRouter.use(authenticate);
salesOrderRouter.get('/', salesController.getAll);
salesOrderRouter.get('/:id', salesController.getById);
salesOrderRouter.post('/', requireRole('ADMIN', 'ACCOUNTANT'), salesController.create);
salesOrderRouter.put('/:id', requireRole('ADMIN', 'ACCOUNTANT'), salesController.update);
salesOrderRouter.post('/:id/convert-to-invoice', requireRole('ADMIN', 'ACCOUNTANT'), salesController.convertToInvoice);

// 4. Customer Invoices Router
const invoiceRouter = express.Router();
invoiceRouter.use(authenticate);
invoiceRouter.get('/', invoiceController.getAll);
invoiceRouter.get('/:id', invoiceController.getById);
invoiceRouter.post('/', requireRole('ADMIN', 'ACCOUNTANT'), invoiceController.create);
invoiceRouter.post('/:id/post', requireRole('ADMIN', 'ACCOUNTANT'), invoiceController.postInvoice);
invoiceRouter.post('/:id/payment', requireRole('ADMIN', 'ACCOUNTANT'), invoiceController.registerPayment);

// 5. Payments Router
const paymentRouter = express.Router();
paymentRouter.use(authenticate);
paymentRouter.get('/', paymentController.getAll);
paymentRouter.get('/:id', paymentController.getById);
paymentRouter.post('/', requireRole('ADMIN', 'ACCOUNTANT'), paymentController.create);

// 6. Journal Entries Router
const journalEntryRouter = express.Router();
journalEntryRouter.use(authenticate);
journalEntryRouter.get('/', journalEntryController.getAll);
journalEntryRouter.get('/:id', journalEntryController.getById);

// Combined Router
const transactionRouter = express.Router();
transactionRouter.use('/purchase-orders', purchaseOrderRouter);
transactionRouter.use('/vendor-bills', vendorBillRouter);
transactionRouter.use('/sales-orders', salesOrderRouter);
transactionRouter.use('/invoices', invoiceRouter);
transactionRouter.use('/payments', paymentRouter);
transactionRouter.use('/journal-entries', journalEntryRouter);

module.exports = {
  transactionRouter,
  purchaseOrderRouter,
  vendorBillRouter,
  salesOrderRouter,
  invoiceRouter,
  paymentRouter,
  journalEntryRouter,
};
