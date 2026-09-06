const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const purchase = require('../services/purchaseService');
const payments = require('../services/paymentService');
const pdfService = require('../services/pdfService');
const { parsePagination, buildPaginationMeta } = require('../lib/pagination');
const { sendServiceError } = require('../lib/serviceError');

const access = (db) => [authenticate(db), authorize('ADMIN', 'ACCOUNTANT')];
const viewAccess = (db) => [authenticate(db), authorize('ADMIN', 'ACCOUNTANT', 'CONTACT')];

function purchasesRoutes(db) {
  const r = express.Router();
  const a = access(db);
  const va = viewAccess(db);

  r.get('/purchases/orders', ...a, async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const q = [];
      const p = [];
      const add = (s, v) => { p.push(v); q.push(s.replace('?', `$${p.length}`)); };
      if (req.query.status) add('o.status=?', req.query.status);
      if (req.query.vendorId) add('o.vendor_id=?', req.query.vendorId);
      if (req.query.search) {
        p.push(`%${String(req.query.search).toLowerCase()}%`);
        q.push(`(lower(o.order_number) LIKE $${p.length} OR lower(coalesce(o.reference,'')) LIKE $${p.length} OR lower(c.name) LIKE $${p.length})`);
      }
      const w = q.length ? `WHERE ${q.join(' AND ')}` : '';
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM purchase_orders o JOIN contacts c ON c.id=o.vendor_id ${w}`, p);
      const rows = await db.query(
        `SELECT o.id, o.order_number AS "orderNumber", o.order_date AS "orderDate", o.status,
                o.total_amount::text AS "totalAmount", c.name AS "vendorName"
         FROM purchase_orders o JOIN contacts c ON c.id=o.vendor_id ${w}
         ORDER BY o.order_date DESC, o.order_number DESC
         LIMIT $${p.length + 1} OFFSET $${p.length + 2}`,
        [...p, limit, offset],
      );
      res.json({ purchaseOrders: rows.rows, pagination: buildPaginationMeta({ page, limit, total: count.rows[0].total }) });
    } catch (e) { next(e); }
  });

  r.post('/purchases/orders', ...a, async (req, res) => {
    try { res.status(201).json({ purchaseOrder: await purchase.createOrder(db, req.user.id, req.body) }); }
    catch (e) { sendServiceError(res, e); }
  });

  r.get('/purchases/orders/:id', ...a, async (req, res, next) => {
    try {
      const x = await purchase.getOrder(db, req.params.id);
      if (!x) return res.status(404).json({ message: 'Purchase Order not found.' });
      res.json({ purchaseOrder: x });
    } catch (e) { next(e); }
  });

  r.patch('/purchases/orders/:id', ...a, async (req, res) => {
    try { res.json({ purchaseOrder: await purchase.updateOrder(db, req.params.id, req.user.id, req.body) }); }
    catch (e) { sendServiceError(res, e); }
  });

  r.post('/purchases/orders/:id/confirm', ...a, async (req, res) => {
    try { res.json({ purchaseOrder: await purchase.transitionOrder(db, req.params.id, req.user.id, 'CONFIRMED') }); }
    catch (e) { sendServiceError(res, e); }
  });

  r.post('/purchases/orders/:id/cancel', ...a, async (req, res) => {
    try { res.json({ purchaseOrder: await purchase.transitionOrder(db, req.params.id, req.user.id, 'CANCELLED') }); }
    catch (e) { sendServiceError(res, e); }
  });

  r.get('/purchases/bills', ...va, async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const q = [];
      const p = [];
      const add = (s, v) => { p.push(v); q.push(s.replace('?', `$${p.length}`)); };
      if (req.user.role === 'CONTACT') {
        if (!req.user.contactId) {
          return res.status(403).json({ message: 'User is not linked to a contact.' });
        }
        add('b.vendor_id=?', req.user.contactId);
      } else if (req.query.vendorId) {
        add('b.vendor_id=?', req.query.vendorId);
      }
      if (req.query.status) add('b.status=?', req.query.status);
      if (req.query.paymentStatus) add('b.payment_status=?', req.query.paymentStatus);
      if (req.query.search) {
        p.push(`%${String(req.query.search).toLowerCase()}%`);
        q.push(`(lower(b.bill_number) LIKE $${p.length} OR lower(coalesce(b.vendor_invoice_number,'')) LIKE $${p.length} OR lower(c.name) LIKE $${p.length})`);
      }
      const w = q.length ? `WHERE ${q.join(' AND ')}` : '';
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM vendor_bills b JOIN contacts c ON c.id=b.vendor_id ${w}`, p);
      const rows = await db.query(
        `SELECT b.id, b.bill_number AS "billNumber", b.vendor_invoice_number AS "vendorInvoiceNumber",
                b.invoice_date AS "invoiceDate", b.due_date AS "dueDate", b.status,
                b.payment_status AS "paymentStatus", b.total_amount::text AS "totalAmount", c.name AS "vendorName"
         FROM vendor_bills b JOIN contacts c ON c.id=b.vendor_id ${w}
         ORDER BY b.invoice_date DESC, b.bill_number DESC
         LIMIT $${p.length + 1} OFFSET $${p.length + 2}`,
        [...p, limit, offset],
      );
      res.json({ vendorBills: rows.rows, pagination: buildPaginationMeta({ page, limit, total: count.rows[0].total }) });
    } catch (e) { next(e); }
  });

  r.post('/purchases/bills', ...a, async (req, res) => {
    try { res.status(201).json({ vendorBill: await purchase.createBill(db, req.user.id, req.body) }); }
    catch (e) { sendServiceError(res, e); }
  });

  r.get('/purchases/bills/from-order/:orderId', ...a, async (req, res) => {
    try { res.json({ vendorBill: await purchase.billFromOrder(db, req.params.orderId) }); }
    catch (e) { sendServiceError(res, e); }
  });

  r.get('/purchases/bills/:id', ...va, async (req, res, next) => {
    try {
      const x = await purchase.getBill(db, req.params.id);
      if (!x) return res.status(404).json({ message: 'Vendor Bill not found.' });
      if (req.user.role === 'CONTACT' && x.vendorId !== req.user.contactId) {
        return res.status(403).json({ message: 'You are not authorized to access this resource.' });
      }
      res.json({ vendorBill: x });
    } catch (e) { next(e); }
  });

  r.get('/purchases/bills/:id/pdf', ...va, async (req, res, next) => {
    try {
      const bill = await purchase.getBill(db, req.params.id);
      if (!bill) return res.status(404).json({ message: 'Vendor Bill not found.' });
      if (req.user.role === 'CONTACT' && bill.vendorId !== req.user.contactId) {
        return res.status(403).json({ message: 'You are not authorized to access this resource.' });
      }
      const outstanding = await payments.getOutstanding(db, 'VENDOR', req.params.id);
      if (outstanding) {
        bill.amountPaid = outstanding.amountPaid;
        bill.outstandingAmount = outstanding.outstandingAmount;
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${bill.billNumber}.pdf"`);
      pdfService.generateBillPdf(bill, res);
    } catch (e) { next(e); }
  });

  r.patch('/purchases/bills/:id', ...a, async (req, res) => {
    try { res.json({ vendorBill: await purchase.updateBill(db, req.params.id, req.user.id, req.body) }); }
    catch (e) { sendServiceError(res, e); }
  });

  r.post('/purchases/bills/:id/post', ...a, async (req, res) => {
    try { res.json({ vendorBill: await purchase.postBill(db, req.params.id, req.user.id) }); }
    catch (e) { sendServiceError(res, e); }
  });

  r.post('/purchases/bills/:id/cancel', ...a, async (req, res) => {
    try { res.json({ vendorBill: await purchase.cancelBill(db, req.params.id, req.user.id) }); }
    catch (e) { sendServiceError(res, e); }
  });

  return r;
}

module.exports = { purchasesRoutes };
