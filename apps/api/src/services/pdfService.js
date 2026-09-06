const PDFDocument = require('pdfkit');

const COMPANY_INFO = {
  name: 'Urban Furniture Pvt. Ltd.',
  tagline: 'Modern & Ergonomic Workspace Solutions',
  address: '104 Industrial Area, Phase II, New Delhi, 110020, India',
  phone: '+91 (011) 4567-8900',
  email: 'accounts@urbanfurniture.local',
  gstin: '07AAAAU1234A1Z5',
  website: 'www.urbanfurniture.local',
};

function formatCurrency(amount) {
  const num = Number(amount || 0);
  return 'INR ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? String(val) : d.toISOString().slice(0, 10);
}

/**
 * Generate Customer Invoice PDF
 */
function generateInvoicePdf(invoice, stream) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(stream);

  // Header Banner
  doc.rect(40, 40, 515, 60).fill('#1e2348');
  doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text(COMPANY_INFO.name, 55, 52);
  doc.fontSize(9).font('Helvetica').fillColor('#b8bfe6').text(COMPANY_INFO.tagline, 55, 76);
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#ffffff').text('CUSTOMER INVOICE', 370, 56, { align: 'right', width: 170 });

  // Company and Invoice Meta
  doc.fillColor('#1e2348').fontSize(8).font('Helvetica');
  doc.text(`${COMPANY_INFO.address} | Phone: ${COMPANY_INFO.phone}`, 40, 110);
  doc.text(`GSTIN: ${COMPANY_INFO.gstin} | Email: ${COMPANY_INFO.email}`, 40, 122);

  doc.rect(40, 136, 515, 1).fill('#e2e8f0');

  // Customer Info (Left) & Invoice Details (Right)
  const metaTop = 145;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e2348').text('BILL TO:', 40, metaTop);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(invoice.customerName || 'Customer', 40, metaTop + 14);
  doc.fontSize(8).font('Helvetica').fillColor('#475569');
  let custY = metaTop + 28;
  if (invoice.customerEmail) { doc.text(`Email: ${invoice.customerEmail}`, 40, custY); custY += 12; }
  if (invoice.customerPhone) { doc.text(`Phone: ${invoice.customerPhone}`, 40, custY); custY += 12; }
  if (invoice.customerAddress) { doc.text(`Address: ${invoice.customerAddress}`, 40, custY, { width: 220 }); }

  const rightColX = 350;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e2348').text('INVOICE DETAILS:', rightColX, metaTop);
  doc.fontSize(8).font('Helvetica').fillColor('#475569');
  doc.text(`Invoice Number:`, rightColX, metaTop + 14);
  doc.font('Helvetica-Bold').fillColor('#0f172a').text(invoice.invoiceNumber, rightColX + 90, metaTop + 14);
  
  doc.font('Helvetica').fillColor('#475569').text(`Invoice Date:`, rightColX, metaTop + 27);
  doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatDate(invoice.invoiceDate), rightColX + 90, metaTop + 27);

  doc.font('Helvetica').fillColor('#475569').text(`Due Date:`, rightColX, metaTop + 40);
  doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatDate(invoice.dueDate), rightColX + 90, metaTop + 40);

  if (invoice.salesOrderNumber) {
    doc.font('Helvetica').fillColor('#475569').text(`Sales Order:`, rightColX, metaTop + 53);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(invoice.salesOrderNumber, rightColX + 90, metaTop + 53);
  }

  doc.font('Helvetica').fillColor('#475569').text(`Payment Status:`, rightColX, metaTop + 66);
  const statusColor = invoice.paymentStatus === 'PAID' ? '#15803d' : (invoice.paymentStatus === 'PARTIALLY_PAID' ? '#b45309' : '#b91c1c');
  doc.font('Helvetica-Bold').fillColor(statusColor).text(invoice.paymentStatus || 'UNPAID', rightColX + 90, metaTop + 66);

  // Items Table Header
  const tableTop = 235;
  doc.rect(40, tableTop, 515, 22).fill('#f1f5f9');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e2348');
  doc.text('ITEM & DESCRIPTION', 48, tableTop + 6);
  doc.text('QTY', 290, tableTop + 6, { width: 40, align: 'right' });
  doc.text('UNIT PRICE', 335, tableTop + 6, { width: 65, align: 'right' });
  doc.text('TAX %', 405, tableTop + 6, { width: 45, align: 'right' });
  doc.text('TOTAL', 460, tableTop + 6, { width: 90, align: 'right' });

  // Items Rows
  let curY = tableTop + 25;
  const items = invoice.items || [];
  items.forEach((item, idx) => {
    if (idx % 2 === 1) {
      doc.rect(40, curY - 3, 515, 18).fill('#fafafa');
    }
    doc.fontSize(8).font('Helvetica').fillColor('#0f172a');
    doc.text(item.productName || 'Item', 48, curY, { width: 235 });
    doc.text(String(item.quantity), 290, curY, { width: 40, align: 'right' });
    doc.text(formatCurrency(item.unitPrice), 335, curY, { width: 65, align: 'right' });
    doc.text(`${item.taxRate || 0}%`, 405, curY, { width: 45, align: 'right' });
    doc.font('Helvetica-Bold').text(formatCurrency(item.lineTotal), 460, curY, { width: 90, align: 'right' });
    curY += 20;
  });

  doc.rect(40, curY + 4, 515, 1).fill('#cbd5e1');
  curY += 14;

  // Summary / Totals Box (Right Aligned)
  const summaryX = 330;
  const valX = 430;
  const valW = 120;

  doc.fontSize(9).font('Helvetica').fillColor('#475569');
  doc.text('Subtotal:', summaryX, curY);
  doc.text(formatCurrency(invoice.subtotal), valX, curY, { width: valW, align: 'right' });
  curY += 16;

  doc.text('Tax Amount:', summaryX, curY);
  doc.text(formatCurrency(invoice.taxAmount), valX, curY, { width: valW, align: 'right' });
  curY += 16;

  doc.rect(summaryX, curY, 225, 1).fill('#e2e8f0');
  curY += 6;

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a');
  doc.text('Total Amount:', summaryX, curY);
  doc.text(formatCurrency(invoice.totalAmount), valX, curY, { width: valW, align: 'right' });
  curY += 18;

  if (invoice.amountPaid !== undefined || invoice.outstandingAmount !== undefined) {
    doc.fontSize(9).font('Helvetica').fillColor('#15803d');
    doc.text('Amount Paid:', summaryX, curY);
    doc.text(formatCurrency(invoice.amountPaid || 0), valX, curY, { width: valW, align: 'right' });
    curY += 16;

    doc.font('Helvetica-Bold').fillColor('#b91c1c');
    doc.text('Balance Outstanding:', summaryX, curY);
    doc.text(formatCurrency(invoice.outstandingAmount ?? invoice.totalAmount), valX, curY, { width: valW, align: 'right' });
    curY += 20;
  }

  // Footer & Payment Terms
  const footerY = 740;
  doc.rect(40, footerY - 15, 515, 1).fill('#cbd5e1');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e2348').text('Terms & Payment Instructions', 40, footerY);
  doc.font('Helvetica').fillColor('#64748b').text('Please remit payment via RTGS/NEFT to Urban Furniture Pvt. Ltd., A/C: 987654321098, IFSC: UTIB0000123. Reference the invoice number on remittance.', 40, footerY + 12, { width: 515 });
  doc.fontSize(7).fillColor('#94a3b8').text('This is a computer-generated tax invoice and requires no physical signature.', 40, footerY + 36, { align: 'center', width: 515 });

  doc.end();
}

/**
 * Generate Vendor Bill PDF
 */
function generateBillPdf(bill, stream) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(stream);

  // Header Banner
  doc.rect(40, 40, 515, 60).fill('#2c3258');
  doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text(COMPANY_INFO.name, 55, 52);
  doc.fontSize(9).font('Helvetica').fillColor('#b8bfe6').text('Accounts Payable · Vendor Bill Record', 55, 76);
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#ffffff').text('VENDOR BILL', 370, 56, { align: 'right', width: 170 });

  // Company and Vendor Info
  doc.fillColor('#2c3258').fontSize(8).font('Helvetica');
  doc.text(`${COMPANY_INFO.name} | ${COMPANY_INFO.address}`, 40, 110);
  doc.text(`GSTIN: ${COMPANY_INFO.gstin} | Phone: ${COMPANY_INFO.phone}`, 40, 122);

  doc.rect(40, 136, 515, 1).fill('#e2e8f0');

  // Vendor Info (Left) & Bill Details (Right)
  const metaTop = 145;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#2c3258').text('VENDOR / SUPPLIER:', 40, metaTop);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(bill.vendorName || 'Vendor', 40, metaTop + 14);
  doc.fontSize(8).font('Helvetica').fillColor('#475569');
  let vendY = metaTop + 28;
  if (bill.vendorEmail) { doc.text(`Email: ${bill.vendorEmail}`, 40, vendY); vendY += 12; }
  if (bill.vendorPhone) { doc.text(`Phone: ${bill.vendorPhone}`, 40, vendY); vendY += 12; }
  if (bill.vendorAddress) { doc.text(`Address: ${bill.vendorAddress}`, 40, vendY, { width: 220 }); }

  const rightColX = 350;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#2c3258').text('BILL DETAILS:', rightColX, metaTop);
  doc.fontSize(8).font('Helvetica').fillColor('#475569');
  doc.text(`Bill Number:`, rightColX, metaTop + 14);
  doc.font('Helvetica-Bold').fillColor('#0f172a').text(bill.billNumber, rightColX + 90, metaTop + 14);

  if (bill.vendorInvoiceNumber) {
    doc.font('Helvetica').fillColor('#475569').text(`Vendor Inv #:`, rightColX, metaTop + 27);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(bill.vendorInvoiceNumber, rightColX + 90, metaTop + 27);
  }

  doc.font('Helvetica').fillColor('#475569').text(`Bill Date:`, rightColX, metaTop + 40);
  doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatDate(bill.invoiceDate), rightColX + 90, metaTop + 40);

  doc.font('Helvetica').fillColor('#475569').text(`Due Date:`, rightColX, metaTop + 53);
  doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatDate(bill.dueDate), rightColX + 90, metaTop + 53);

  doc.font('Helvetica').fillColor('#475569').text(`Payment Status:`, rightColX, metaTop + 66);
  const payStatus = bill.paymentStatus || bill.payment_status || 'UNPAID';
  const statusColor = payStatus === 'PAID' ? '#15803d' : (payStatus === 'PARTIALLY_PAID' ? '#b45309' : '#b91c1c');
  doc.font('Helvetica-Bold').fillColor(statusColor).text(payStatus, rightColX + 90, metaTop + 66);

  // Items Table Header
  const tableTop = 235;
  doc.rect(40, tableTop, 515, 22).fill('#f1f5f9');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#2c3258');
  doc.text('PRODUCT / SERVICE', 48, tableTop + 6);
  doc.text('QTY', 290, tableTop + 6, { width: 40, align: 'right' });
  doc.text('UNIT PRICE', 335, tableTop + 6, { width: 65, align: 'right' });
  doc.text('TAX %', 405, tableTop + 6, { width: 45, align: 'right' });
  doc.text('TOTAL', 460, tableTop + 6, { width: 90, align: 'right' });

  // Items Rows
  let curY = tableTop + 25;
  const items = bill.items || [];
  items.forEach((item, idx) => {
    if (idx % 2 === 1) {
      doc.rect(40, curY - 3, 515, 18).fill('#fafafa');
    }
    doc.fontSize(8).font('Helvetica').fillColor('#0f172a');
    doc.text(item.productName || 'Item', 48, curY, { width: 235 });
    doc.text(String(item.quantity), 290, curY, { width: 40, align: 'right' });
    doc.text(formatCurrency(item.unitPrice), 335, curY, { width: 65, align: 'right' });
    doc.text(`${item.taxRate || 0}%`, 405, curY, { width: 45, align: 'right' });
    doc.font('Helvetica-Bold').text(formatCurrency(item.lineTotal), 460, curY, { width: 90, align: 'right' });
    curY += 20;
  });

  doc.rect(40, curY + 4, 515, 1).fill('#cbd5e1');
  curY += 14;

  // Summary / Totals Box
  const summaryX = 330;
  const valX = 430;
  const valW = 120;

  doc.fontSize(9).font('Helvetica').fillColor('#475569');
  doc.text('Subtotal:', summaryX, curY);
  doc.text(formatCurrency(bill.subtotal), valX, curY, { width: valW, align: 'right' });
  curY += 16;

  doc.text('Tax Amount:', summaryX, curY);
  doc.text(formatCurrency(bill.taxAmount), valX, curY, { width: valW, align: 'right' });
  curY += 16;

  doc.rect(summaryX, curY, 225, 1).fill('#e2e8f0');
  curY += 6;

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a');
  doc.text('Total Bill Amount:', summaryX, curY);
  doc.text(formatCurrency(bill.totalAmount), valX, curY, { width: valW, align: 'right' });
  curY += 18;

  if (bill.amountPaid !== undefined || bill.outstandingAmount !== undefined) {
    doc.fontSize(9).font('Helvetica').fillColor('#15803d');
    doc.text('Amount Paid:', summaryX, curY);
    doc.text(formatCurrency(bill.amountPaid || 0), valX, curY, { width: valW, align: 'right' });
    curY += 16;

    doc.font('Helvetica-Bold').fillColor('#b91c1c');
    doc.text('Outstanding Payable:', summaryX, curY);
    doc.text(formatCurrency(bill.outstandingAmount ?? bill.totalAmount), valX, curY, { width: valW, align: 'right' });
    curY += 20;
  }

  const footerY = 740;
  doc.rect(40, footerY - 15, 515, 1).fill('#cbd5e1');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#2c3258').text('Accounts Payable Verification', 40, footerY);
  doc.font('Helvetica').fillColor('#64748b').text('Urban Furniture Internal Accounts Payable voucher. Generated in compliance with statutory input tax accounting standards.', 40, footerY + 12, { width: 515 });
  doc.fontSize(7).fillColor('#94a3b8').text('Official accounts record generated from Urban Furniture Accounting System.', 40, footerY + 36, { align: 'center', width: 515 });

  doc.end();
}

/**
 * Generate Payment Receipt PDF (Customer or Vendor)
 */
function generatePaymentReceiptPdf(payment, stream) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(stream);

  const isCustomer = payment.type === 'CUSTOMER';
  const receiptTitle = isCustomer ? 'OFFICIAL PAYMENT RECEIPT' : 'VENDOR PAYMENT VOUCHER';
  const bannerBg = isCustomer ? '#0f766e' : '#334155';

  // Header Banner
  doc.rect(40, 40, 515, 60).fill(bannerBg);
  doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text(COMPANY_INFO.name, 55, 52);
  doc.fontSize(9).font('Helvetica').fillColor('#ccfbf1').text(COMPANY_INFO.tagline, 55, 76);
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#ffffff').text(receiptTitle, 350, 58, { align: 'right', width: 190 });

  // Company Info
  doc.fillColor('#334155').fontSize(8).font('Helvetica');
  doc.text(`${COMPANY_INFO.address} | Phone: ${COMPANY_INFO.phone}`, 40, 110);
  doc.text(`GSTIN: ${COMPANY_INFO.gstin} | Email: ${COMPANY_INFO.email}`, 40, 122);

  doc.rect(40, 136, 515, 1).fill('#e2e8f0');

  // Receipt Details
  const metaTop = 150;
  const partyLabel = isCustomer ? 'RECEIVED FROM:' : 'PAID TO:';
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(partyLabel, 40, metaTop);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f766e').text(payment.contactName || 'Contact', 40, metaTop + 14);

  const rightColX = 350;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text('RECEIPT DETAILS:', rightColX, metaTop);
  doc.fontSize(8).font('Helvetica').fillColor('#475569');
  doc.text('Receipt / Payment #:', rightColX, metaTop + 14);
  doc.font('Helvetica-Bold').fillColor('#0f172a').text(payment.paymentNumber, rightColX + 90, metaTop + 14);

  doc.font('Helvetica').fillColor('#475569').text('Payment Date:', rightColX, metaTop + 27);
  doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatDate(payment.paymentDate), rightColX + 90, metaTop + 27);

  doc.font('Helvetica').fillColor('#475569').text('Payment Method:', rightColX, metaTop + 40);
  doc.font('Helvetica-Bold').fillColor('#0f172a').text(payment.method || 'BANK_TRANSFER', rightColX + 90, metaTop + 40);

  if (payment.reference) {
    doc.font('Helvetica').fillColor('#475569').text('Reference / Cheque:', rightColX, metaTop + 53);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(payment.reference, rightColX + 90, metaTop + 53);
  }

  doc.font('Helvetica').fillColor('#475569').text('Status:', rightColX, metaTop + 66);
  doc.font('Helvetica-Bold').fillColor(payment.status === 'POSTED' ? '#15803d' : '#b91c1c').text(payment.status, rightColX + 90, metaTop + 66);

  // Big Amount Box
  const amountBoxTop = 235;
  doc.rect(40, amountBoxTop, 515, 60).fill('#f8fafc');
  doc.rect(40, amountBoxTop, 515, 60).stroke('#cbd5e1');
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b').text('PAYMENT AMOUNT', 55, amountBoxTop + 12);
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f766e').text(formatCurrency(payment.amount), 55, amountBoxTop + 28);

  // Allocation table
  const allocTop = 320;
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text('Applied Allocation Details', 40, allocTop);
  doc.rect(40, allocTop + 15, 515, 20).fill('#f1f5f9');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155');
  doc.text('DOCUMENT REFERENCE', 48, allocTop + 21);
  doc.text('TYPE', 260, allocTop + 21);
  doc.text('APPLIED AMOUNT', 430, allocTop + 21, { width: 115, align: 'right' });

  const docRef = payment.customerInvoiceNumber || payment.vendorBillNumber || 'Account Balance';
  const docType = isCustomer ? 'Customer Invoice' : 'Vendor Bill';
  doc.fontSize(9).font('Helvetica').fillColor('#0f172a');
  doc.text(docRef, 48, allocTop + 45);
  doc.text(docType, 260, allocTop + 45);
  doc.font('Helvetica-Bold').text(formatCurrency(payment.amount), 430, allocTop + 45, { width: 115, align: 'right' });

  doc.rect(40, allocTop + 65, 515, 1).fill('#cbd5e1');

  // Signoff & Authorization
  const authTop = 450;
  doc.fontSize(8).font('Helvetica').fillColor('#475569');
  doc.text(`Recorded By User: ${payment.createdBy || 'Authorized Accountant'}`, 40, authTop);
  if (payment.status === 'POSTED') {
    doc.text(`Journal Entry Ref: Official posted financial ledger entry`, 40, authTop + 14);
  }

  const footerY = 740;
  doc.rect(40, footerY - 15, 515, 1).fill('#cbd5e1');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155').text('Official Urban Furniture Transaction Acknowledgment', 40, footerY);
  doc.font('Helvetica').fillColor('#64748b').text('This document serves as authoritative proof of payment transaction recorded in Urban Furniture Accounting System.', 40, footerY + 12, { width: 515 });
  doc.fontSize(7).fillColor('#94a3b8').text('Generated electronically · Immutable accounting voucher', 40, footerY + 36, { align: 'center', width: 515 });

  doc.end();
}

module.exports = {
  generateInvoicePdf,
  generateBillPdf,
  generatePaymentReceiptPdf,
};
