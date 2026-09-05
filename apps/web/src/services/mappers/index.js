/**
 * Data Mapper functions
 * Converts backend DB representations to unified frontend models
 * without modifying backend responses directly.
 */

export function mapContact(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name || raw.contact_name || raw.login_id || 'Unnamed Contact',
    type: raw.type || raw.account_type || (raw.role === 'CONTACT' ? 'CUSTOMER' : 'CUSTOMER'),
    email: raw.email || '',
    phone: raw.phone || '',
    city: raw.city || raw.address_city || '',
    taxId: raw.tax_id || raw.taxId || '',
    paymentTerms: raw.payment_terms || raw.paymentTerms || '30 Days',
    balance: Number(raw.balance ?? 0),
    status: raw.status || (raw.is_active ? 'ACTIVE' : 'INACTIVE'),
    raw,
  };
}

export function mapProduct(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name || 'Unnamed Product',
    sku: raw.sku || raw.code || '',
    category: raw.category || 'General',
    salesPrice: Number(raw.sales_price ?? raw.salesPrice ?? raw.price ?? 0),
    costPrice: Number(raw.cost_price ?? raw.costPrice ?? raw.cost ?? 0),
    taxPercent: Number(raw.tax_percent ?? raw.taxPercent ?? raw.tax ?? 10),
    stockQuantity: Number(raw.stock_quantity ?? raw.stockQuantity ?? raw.stock ?? 0),
    uom: raw.uom || 'Units',
    status: raw.status || (raw.is_active ? 'ACTIVE' : 'ACTIVE'),
    raw,
  };
}

export function mapAccount(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    code: raw.code || raw.account_code || '',
    name: raw.name || raw.account_name || '',
    type: (raw.type || raw.account_type || 'ASSET').toUpperCase(),
    currency: raw.currency || 'USD',
    balance: Number(raw.balance ?? 0),
    reconcilable: Boolean(raw.reconcilable ?? true),
    status: raw.status || 'ACTIVE',
    raw,
  };
}

export function mapJournal(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name || '',
    code: raw.code || '',
    type: (raw.type || 'GENERAL').toUpperCase(),
    defaultAccount: raw.default_account || raw.defaultAccount || '',
    shortCode: raw.short_code || raw.shortCode || raw.code || '',
    raw,
  };
}

export function mapAnalyticAccount(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name || '',
    code: raw.code || '',
    partner: raw.partner || raw.partner_name || 'Internal',
    budget: Number(raw.budget ?? 0),
    spent: Number(raw.spent ?? raw.actual_spent ?? 0),
    status: raw.status || 'ACTIVE',
    raw,
  };
}

export function mapBudget(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name || '',
    dateFrom: raw.date_from || raw.dateFrom || '',
    dateTo: raw.date_to || raw.dateTo || '',
    totalPlanned: Number(raw.total_planned ?? raw.totalPlanned ?? 0),
    totalPractical: Number(raw.total_practical ?? raw.totalPractical ?? 0),
    lines: (raw.lines || []).map((line) => ({
      id: line.id,
      name: line.name || '',
      account: line.account || '',
      plannedAmount: Number(line.planned_amount ?? line.plannedAmount ?? 0),
      practicalAmount: Number(line.practical_amount ?? line.practicalAmount ?? 0),
    })),
    raw,
  };
}

export function mapSalesOrder(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    orderNumber: raw.order_number || raw.orderNumber || raw.name || `SO-${raw.id}`,
    customerId: raw.customer_id || raw.customerId || raw.partner_id,
    customerName: raw.customer_name || raw.customerName || raw.partner_name || 'Customer',
    orderDate: raw.order_date || raw.orderDate || raw.date || '',
    status: (raw.status || 'QUOTATION').toUpperCase(),
    invoiceStatus: (raw.invoice_status || raw.invoiceStatus || 'NOTHING TO INVOICE').toUpperCase(),
    paymentTerms: raw.payment_terms || raw.paymentTerms || '30 Days',
    items: (raw.items || []).map((item) => ({
      productId: item.product_id || item.productId,
      productName: item.product_name || item.productName || 'Item',
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
      taxPercent: Number(item.tax_percent ?? item.taxPercent ?? 0),
      subtotal: Number(item.subtotal ?? (item.quantity * item.unitPrice) ?? 0),
    })),
    subtotal: Number(raw.subtotal ?? 0),
    tax: Number(raw.tax ?? 0),
    total: Number(raw.total ?? raw.amount_total ?? 0),
    raw,
  };
}

export function mapPurchaseOrder(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    orderNumber: raw.order_number || raw.orderNumber || raw.name || `PO-${raw.id}`,
    vendorId: raw.vendor_id || raw.vendorId || raw.partner_id,
    vendorName: raw.vendor_name || raw.vendorName || raw.partner_name || 'Vendor',
    orderDate: raw.order_date || raw.orderDate || raw.date || '',
    status: (raw.status || 'RFQ').toUpperCase(),
    billStatus: (raw.bill_status || raw.billStatus || 'NOTHING TO BILL').toUpperCase(),
    paymentTerms: raw.payment_terms || raw.paymentTerms || '30 Days',
    items: (raw.items || []).map((item) => ({
      productId: item.product_id || item.productId,
      productName: item.product_name || item.productName || 'Item',
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
      taxPercent: Number(item.tax_percent ?? item.taxPercent ?? 0),
      subtotal: Number(item.subtotal ?? (item.quantity * item.unitPrice) ?? 0),
    })),
    subtotal: Number(raw.subtotal ?? 0),
    tax: Number(raw.tax ?? 0),
    total: Number(raw.total ?? raw.amount_total ?? 0),
    raw,
  };
}

export function mapInvoice(raw) {
  if (!raw) return null;
  const total = Number(raw.total ?? raw.amount_total ?? 0);
  const paid = Number(raw.paid ?? raw.amount_paid ?? 0);
  return {
    id: raw.id,
    invoiceNumber: raw.invoice_number || raw.invoiceNumber || raw.number || `INV-${raw.id}`,
    salesOrderId: raw.sales_order_id || raw.salesOrderId,
    customerId: raw.customer_id || raw.customerId,
    customerName: raw.customer_name || raw.customerName || 'Customer',
    invoiceDate: raw.invoice_date || raw.invoiceDate || raw.date || '',
    dueDate: raw.due_date || raw.dueDate || '',
    paymentTerms: raw.payment_terms || raw.paymentTerms || '30 Days',
    status: (raw.status || 'DRAFT').toUpperCase(),
    items: (raw.items || []).map((item) => ({
      productId: item.product_id || item.productId,
      productName: item.product_name || item.productName || 'Item',
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
      taxPercent: Number(item.tax_percent ?? item.taxPercent ?? 0),
      subtotal: Number(item.subtotal ?? 0),
    })),
    subtotal: Number(raw.subtotal ?? 0),
    tax: Number(raw.tax ?? 0),
    total,
    paid,
    outstanding: Math.max(0, total - paid),
    raw,
  };
}

export function mapVendorBill(raw) {
  if (!raw) return null;
  const total = Number(raw.total ?? raw.amount_total ?? 0);
  const paid = Number(raw.paid ?? raw.amount_paid ?? 0);
  return {
    id: raw.id,
    billNumber: raw.bill_number || raw.billNumber || raw.number || `BILL-${raw.id}`,
    purchaseOrderId: raw.purchase_order_id || raw.purchaseOrderId,
    vendorId: raw.vendor_id || raw.vendorId,
    vendorName: raw.vendor_name || raw.vendorName || 'Vendor',
    billDate: raw.bill_date || raw.billDate || raw.date || '',
    dueDate: raw.due_date || raw.dueDate || '',
    paymentTerms: raw.payment_terms || raw.paymentTerms || '30 Days',
    status: (raw.status || 'DRAFT').toUpperCase(),
    items: (raw.items || []).map((item) => ({
      productId: item.product_id || item.productId,
      productName: item.product_name || item.productName || 'Item',
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
      taxPercent: Number(item.tax_percent ?? item.taxPercent ?? 0),
      subtotal: Number(item.subtotal ?? 0),
    })),
    subtotal: Number(raw.subtotal ?? 0),
    tax: Number(raw.tax ?? 0),
    total,
    paid,
    outstanding: Math.max(0, total - paid),
    raw,
  };
}

export function mapPayment(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    paymentNumber: raw.payment_number || raw.paymentNumber || `PAY-${raw.id}`,
    type: (raw.type || 'INBOUND').toUpperCase(),
    targetType: (raw.target_type || raw.targetType || 'INVOICE').toUpperCase(),
    targetId: raw.target_id || raw.targetId,
    targetNumber: raw.target_number || raw.targetNumber || '',
    partnerName: raw.partner_name || raw.partnerName || 'Partner',
    amount: Number(raw.amount ?? 0),
    method: raw.method || 'Bank',
    journalId: raw.journal_id || raw.journalId || '',
    journalName: raw.journal_name || raw.journalName || '',
    date: raw.date || raw.payment_date || '',
    memo: raw.memo || raw.reference || '',
    raw,
  };
}
