const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const payments = require('../services/paymentService');
const pdfService = require('../services/pdfService');
const { parsePagination, buildPaginationMeta } = require('../lib/pagination');
const { sendServiceError } = require('../lib/serviceError');

const access = (db) => [authenticate(db), authorize('ADMIN', 'ACCOUNTANT')];
const viewAccess = (db) => [authenticate(db), authorize('ADMIN', 'ACCOUNTANT', 'CONTACT')];

function paymentsRoutes(db) {
  const router = express.Router();
  const a = access(db);
  const va = viewAccess(db);

  router.get('/payments', ...va, async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const conditions = [];
      const params = [];
      const add = (column, value) => { params.push(value); conditions.push(`${column} = $${params.length}`); };

      if (req.user.role === 'CONTACT') {
        if (!req.user.contactId) {
          return res.status(403).json({ message: 'User is not linked to a contact.' });
        }
        add('p.contact_id', req.user.contactId);
      } else if (req.query.contactId) {
        add('p.contact_id', req.query.contactId);
      }

      if (req.query.type) add('p.type', req.query.type);
      if (req.query.status) add('p.status', req.query.status);
      if (req.query.customerInvoiceId) add('p.customer_invoice_id', req.query.customerInvoiceId);
      if (req.query.vendorBillId) add('p.vendor_bill_id', req.query.vendorBillId);
      if (req.query.search) {
        params.push(`%${String(req.query.search).toLowerCase()}%`);
        conditions.push(`(lower(p.payment_number) LIKE $${params.length} OR lower(c.name) LIKE $${params.length})`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM payments p JOIN contacts c ON c.id = p.contact_id ${where}`, params);
      const rows = await db.query(
        `SELECT ${payments.paymentSelect} FROM payments p ${payments.paymentJoins} ${where}
         ORDER BY p.payment_date DESC, p.payment_number DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );
      return res.json({ payments: rows.rows, pagination: buildPaginationMeta({ page, limit, total: count.rows[0].total }) });
    } catch (error) { return next(error); }
  });

  router.get('/payments/:id', ...va, async (req, res, next) => {
    try {
      const payment = await payments.getPayment(db, req.params.id);
      if (!payment) return res.status(404).json({ message: 'Payment not found.' });
      if (req.user.role === 'CONTACT' && payment.contactId !== req.user.contactId) {
        return res.status(403).json({ message: 'You are not authorized to access this resource.' });
      }
      return res.json({ payment });
    } catch (error) { return next(error); }
  });

  router.get('/payments/:id/receipt/pdf', ...va, async (req, res, next) => {
    try {
      const payment = await payments.getPayment(db, req.params.id);
      if (!payment) return res.status(404).json({ message: 'Payment not found.' });
      if (req.user.role === 'CONTACT' && payment.contactId !== req.user.contactId) {
        return res.status(403).json({ message: 'You are not authorized to access this resource.' });
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="RECEIPT-${payment.paymentNumber}.pdf"`);
      pdfService.generatePaymentReceiptPdf(payment, res);
    } catch (error) { return next(error); }
  });

  router.post('/sales/invoices/:id/payments', ...a, async (req, res) => {
    try { res.status(201).json({ payment: await payments.recordCustomerPayment(db, req.user.id, req.params.id, req.body) }); }
    catch (error) { sendServiceError(res, error); }
  });

  router.get('/sales/invoices/:id/outstanding', ...va, async (req, res, next) => {
    try {
      if (req.user.role === 'CONTACT') {
        const check = await db.query('SELECT customer_id FROM customer_invoices WHERE id = $1', [req.params.id]);
        if (!check.rowCount) return res.status(404).json({ message: 'Customer Invoice not found.' });
        if (check.rows[0].customer_id !== req.user.contactId) {
          return res.status(403).json({ message: 'You are not authorized to access this resource.' });
        }
      }
      const outstanding = await payments.getOutstanding(db, 'CUSTOMER', req.params.id);
      if (!outstanding) return res.status(404).json({ message: 'Customer Invoice not found.' });
      return res.json(outstanding);
    } catch (error) { return next(error); }
  });

  router.post('/purchases/bills/:id/payments', ...a, async (req, res) => {
    try { res.status(201).json({ payment: await payments.recordVendorPayment(db, req.user.id, req.params.id, req.body) }); }
    catch (error) { sendServiceError(res, error); }
  });

  router.get('/purchases/bills/:id/outstanding', ...va, async (req, res, next) => {
    try {
      if (req.user.role === 'CONTACT') {
        const check = await db.query('SELECT vendor_id FROM vendor_bills WHERE id = $1', [req.params.id]);
        if (!check.rowCount) return res.status(404).json({ message: 'Vendor Bill not found.' });
        if (check.rows[0].vendor_id !== req.user.contactId) {
          return res.status(403).json({ message: 'You are not authorized to access this resource.' });
        }
      }
      const outstanding = await payments.getOutstanding(db, 'VENDOR', req.params.id);
      if (!outstanding) return res.status(404).json({ message: 'Vendor Bill not found.' });
      return res.json(outstanding);
    } catch (error) { return next(error); }
  });

  router.post('/payments/:id/cancel', ...a, async (req, res) => {
    try { res.json({ payment: await payments.cancelPayment(db, req.user.id, req.params.id) }); }
    catch (error) { sendServiceError(res, error); }
  });

  return router;
}

module.exports = { paymentsRoutes };
