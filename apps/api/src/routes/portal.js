const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');

function portalRoutes(db) {
  const router = express.Router();
  const access = [authenticate(db), authorize('CONTACT')];

  router.get('/portal/summary', ...access, async (req, res, next) => {
    try {
      const contactId = req.user.contactId;
      if (!contactId) {
        return res.status(403).json({ message: 'User is not linked to an active contact profile.' });
      }

      const accountType = req.user.accountType;

      if (accountType === 'CUSTOMER') {
        const statsQuery = await db.query(
          `SELECT
             COUNT(*)::int AS "totalInvoices",
             COUNT(*) FILTER (WHERE i.status = 'POSTED' AND i.payment_status = 'PAID')::int AS "paidInvoices",
             COUNT(*) FILTER (WHERE i.status = 'POSTED' AND i.payment_status = 'PARTIALLY_PAID')::int AS "partiallyPaidInvoices",
             COUNT(*) FILTER (WHERE i.status = 'POSTED' AND i.payment_status = 'UNPAID')::int AS "unpaidInvoices",
             COUNT(*) FILTER (WHERE i.status = 'POSTED' AND i.payment_status != 'PAID' AND i.due_date < CURRENT_DATE)::int AS "overdueInvoices",
             COALESCE(
               SUM(CASE WHEN i.status = 'POSTED' THEN i.total_amount ELSE 0 END) -
               (SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN customer_invoices ci ON ci.id = p.customer_invoice_id WHERE ci.customer_id = $1 AND ci.status = 'POSTED' AND p.status = 'POSTED'),
               0
             )::numeric(12,2)::text AS "outstandingAmount"
           FROM customer_invoices i
           WHERE i.customer_id = $1`,
          [contactId],
        );

        const recentInvoices = await db.query(
          `SELECT i.id, i.invoice_number AS "invoiceNumber", i.invoice_date AS "invoiceDate", i.due_date AS "dueDate",
                  i.status, i.payment_status AS "paymentStatus", i.total_amount::text AS "totalAmount"
           FROM customer_invoices i
           WHERE i.customer_id = $1
           ORDER BY i.invoice_date DESC, i.invoice_number DESC
           LIMIT 5`,
          [contactId],
        );

        const recentPayments = await db.query(
          `SELECT p.id, p.payment_number AS "paymentNumber", p.payment_date AS "paymentDate",
                  p.amount::text AS amount, p.method, p.reference, p.status, ci.invoice_number AS "invoiceNumber"
           FROM payments p
           LEFT JOIN customer_invoices ci ON ci.id = p.customer_invoice_id
           WHERE p.contact_id = $1
           ORDER BY p.payment_date DESC, p.payment_number DESC
           LIMIT 5`,
          [contactId],
        );

        return res.json({
          summary: {
            accountType: 'CUSTOMER',
            kpis: statsQuery.rows[0],
            recentInvoices: recentInvoices.rows,
            recentPayments: recentPayments.rows,
          },
        });
      }

      if (accountType === 'VENDOR') {
        const statsQuery = await db.query(
          `SELECT
             COUNT(*)::int AS "totalBills",
             COUNT(*) FILTER (WHERE b.status = 'POSTED' AND b.payment_status = 'PAID')::int AS "paidBills",
             COUNT(*) FILTER (WHERE b.status = 'POSTED' AND b.payment_status = 'PARTIALLY_PAID')::int AS "partiallyPaidBills",
             COUNT(*) FILTER (WHERE b.status = 'POSTED' AND b.payment_status = 'UNPAID')::int AS "unpaidBills",
             COUNT(*) FILTER (WHERE b.status = 'POSTED' AND b.payment_status != 'PAID' AND b.due_date < CURRENT_DATE)::int AS "overdueBills",
             COALESCE(
               SUM(CASE WHEN b.status = 'POSTED' THEN b.total_amount ELSE 0 END) -
               (SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN vendor_bills vb ON vb.id = p.vendor_bill_id WHERE vb.vendor_id = $1 AND vb.status = 'POSTED' AND p.status = 'POSTED'),
               0
             )::numeric(12,2)::text AS "outstandingPayable"
           FROM vendor_bills b
           WHERE b.vendor_id = $1`,
          [contactId],
        );

        const recentBills = await db.query(
          `SELECT b.id, b.bill_number AS "billNumber", b.vendor_invoice_number AS "vendorInvoiceNumber",
                  b.invoice_date AS "invoiceDate", b.due_date AS "dueDate", b.status,
                  b.payment_status AS "paymentStatus", b.total_amount::text AS "totalAmount"
           FROM vendor_bills b
           WHERE b.vendor_id = $1
           ORDER BY b.invoice_date DESC, b.bill_number DESC
           LIMIT 5`,
          [contactId],
        );

        const recentPayments = await db.query(
          `SELECT p.id, p.payment_number AS "paymentNumber", p.payment_date AS "paymentDate",
                  p.amount::text AS amount, p.method, p.reference, p.status, vb.bill_number AS "billNumber"
           FROM payments p
           LEFT JOIN vendor_bills vb ON vb.id = p.vendor_bill_id
           WHERE p.contact_id = $1
           ORDER BY p.payment_date DESC, p.payment_number DESC
           LIMIT 5`,
          [contactId],
        );

        return res.json({
          summary: {
            accountType: 'VENDOR',
            kpis: statsQuery.rows[0],
            recentBills: recentBills.rows,
            recentPayments: recentPayments.rows,
          },
        });
      }

      return res.status(400).json({ message: 'Unknown or unconfigured account type for portal.' });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { portalRoutes };
