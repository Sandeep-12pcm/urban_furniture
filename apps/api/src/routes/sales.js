const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const sales = require('../services/salesService');
const payments = require('../services/paymentService');
const pdfService = require('../services/pdfService');
const { parsePagination, buildPaginationMeta } = require('../lib/pagination');
const { sendServiceError } = require('../lib/serviceError');

const access = (db) => [authenticate(db), authorize('ADMIN', 'ACCOUNTANT')];
const viewAccess = (db) => [authenticate(db), authorize('ADMIN', 'ACCOUNTANT', 'CONTACT')];

function salesRoutes(db) {
  const router = express.Router();
  const a = access(db);
  const va = viewAccess(db);

  router.get('/sales/orders', ...a, async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const conditions = [];
      const params = [];
      const add = (sql, value) => { params.push(value); conditions.push(sql.replace('?', `$${params.length}`)); };
      if (req.query.status) add('o.status = ?', req.query.status);
      if (req.query.customerId) add('o.customer_id = ?', req.query.customerId);
      if (req.query.search) {
        params.push(`%${String(req.query.search).toLowerCase()}%`);
        conditions.push(`(lower(o.order_number) LIKE $${params.length} OR lower(coalesce(o.reference,'')) LIKE $${params.length} OR lower(c.name) LIKE $${params.length})`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM sales_orders o JOIN contacts c ON c.id = o.customer_id ${where}`, params);
      const rows = await db.query(
        `SELECT o.id, o.order_number AS "orderNumber", o.order_date AS "orderDate", o.status,
                o.total_amount::text AS "totalAmount", c.name AS "customerName"
         FROM sales_orders o JOIN contacts c ON c.id = o.customer_id ${where}
         ORDER BY o.order_date DESC, o.order_number DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );
      return res.json({ salesOrders: rows.rows, pagination: buildPaginationMeta({ page, limit, total: count.rows[0].total }) });
    } catch (error) { return next(error); }
  });

  router.post('/sales/orders', ...a, async (req, res) => {
    try { res.status(201).json({ salesOrder: await sales.createOrder(db, req.user.id, req.body) }); }
    catch (error) { sendServiceError(res, error); }
  });

  router.get('/sales/orders/:id', ...a, async (req, res, next) => {
    try {
      const order = await sales.getOrder(db, req.params.id);
      if (!order) return res.status(404).json({ message: 'Sales Order not found.' });
      return res.json({ salesOrder: order });
    } catch (error) { return next(error); }
  });

  router.patch('/sales/orders/:id', ...a, async (req, res) => {
    try { res.json({ salesOrder: await sales.updateOrder(db, req.params.id, req.user.id, req.body) }); }
    catch (error) { sendServiceError(res, error); }
  });

  router.post('/sales/orders/:id/confirm', ...a, async (req, res) => {
    try { res.json({ salesOrder: await sales.confirmOrder(db, req.params.id, req.user.id) }); }
    catch (error) { sendServiceError(res, error); }
  });

  router.post('/sales/orders/:id/cancel', ...a, async (req, res) => {
    try { res.json({ salesOrder: await sales.cancelOrder(db, req.params.id, req.user.id) }); }
    catch (error) { sendServiceError(res, error); }
  });

  router.get('/sales/invoices', ...va, async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const conditions = [];
      const params = [];
      const add = (sql, value) => { params.push(value); conditions.push(sql.replace('?', `$${params.length}`)); };
      if (req.user.role === 'CONTACT') {
        if (!req.user.contactId) {
          return res.status(403).json({ message: 'User is not linked to a contact.' });
        }
        add('i.customer_id = ?', req.user.contactId);
      } else if (req.query.customerId) {
        add('i.customer_id = ?', req.query.customerId);
      }
      if (req.query.status) add('i.status = ?', req.query.status);
      if (req.query.paymentStatus) add('i.payment_status = ?', req.query.paymentStatus);
      if (req.query.search) {
        params.push(`%${String(req.query.search).toLowerCase()}%`);
        conditions.push(`(lower(i.invoice_number) LIKE $${params.length} OR lower(coalesce(i.reference,'')) LIKE $${params.length} OR lower(c.name) LIKE $${params.length})`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM customer_invoices i JOIN contacts c ON c.id = i.customer_id ${where}`, params);
      const rows = await db.query(
        `SELECT i.id, i.invoice_number AS "invoiceNumber", i.invoice_date AS "invoiceDate", i.due_date AS "dueDate",
                i.status, i.payment_status AS "paymentStatus", i.total_amount::text AS "totalAmount", c.name AS "customerName"
         FROM customer_invoices i JOIN contacts c ON c.id = i.customer_id ${where}
         ORDER BY i.invoice_date DESC, i.invoice_number DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );
      return res.json({ customerInvoices: rows.rows, pagination: buildPaginationMeta({ page, limit, total: count.rows[0].total }) });
    } catch (error) { return next(error); }
  });

  router.post('/sales/invoices', ...a, async (req, res) => {
    try { res.status(201).json({ customerInvoice: await sales.createInvoice(db, req.user.id, req.body) }); }
    catch (error) { sendServiceError(res, error); }
  });

  router.get('/sales/invoices/from-order/:orderId', ...a, async (req, res) => {
    try { res.json({ customerInvoice: await sales.invoiceFromOrder(db, req.params.orderId) }); }
    catch (error) { sendServiceError(res, error); }
  });

  router.get('/sales/invoices/:id', ...va, async (req, res, next) => {
    try {
      const invoice = await sales.getInvoice(db, req.params.id);
      if (!invoice) return res.status(404).json({ message: 'Customer Invoice not found.' });
      if (req.user.role === 'CONTACT' && invoice.customerId !== req.user.contactId) {
        return res.status(403).json({ message: 'You are not authorized to access this resource.' });
      }
      return res.json({ customerInvoice: invoice });
    } catch (error) { return next(error); }
  });

  router.get('/sales/invoices/:id/pdf', ...va, async (req, res, next) => {
    try {
      const invoice = await sales.getInvoice(db, req.params.id);
      if (!invoice) return res.status(404).json({ message: 'Customer Invoice not found.' });
      if (req.user.role === 'CONTACT' && invoice.customerId !== req.user.contactId) {
        return res.status(403).json({ message: 'You are not authorized to access this resource.' });
      }
      const outstanding = await payments.getOutstanding(db, 'CUSTOMER', req.params.id);
      if (outstanding) {
        invoice.amountPaid = outstanding.amountPaid;
        invoice.outstandingAmount = outstanding.outstandingAmount;
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      pdfService.generateInvoicePdf(invoice, res);
    } catch (error) { return next(error); }
  });

  router.patch('/sales/invoices/:id', ...a, async (req, res) => {
    try { res.json({ customerInvoice: await sales.updateInvoice(db, req.params.id, req.user.id, req.body) }); }
    catch (error) { sendServiceError(res, error); }
  });

  router.post('/sales/invoices/:id/post', ...a, async (req, res) => {
    try { res.json({ customerInvoice: await sales.postInvoice(db, req.params.id, req.user.id) }); }
    catch (error) { sendServiceError(res, error); }
  });

  router.post('/sales/invoices/:id/cancel', ...a, async (req, res) => {
    try { res.json({ customerInvoice: await sales.cancelInvoice(db, req.params.id, req.user.id) }); }
    catch (error) { sendServiceError(res, error); }
  });

  return router;
}

module.exports = { salesRoutes };
