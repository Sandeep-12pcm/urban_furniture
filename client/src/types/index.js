/**
 * Urban Furniture Accounting System - Core Data Types & Definitions
 */

/**
 * @typedef {'CUSTOMER' | 'VENDOR'} ContactType
 * @typedef {'ACTIVE' | 'INACTIVE'} ContactStatus
 *
 * @typedef {Object} Contact
 * @property {string} id
 * @property {string} name
 * @property {ContactType} type
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [city]
 * @property {string} [taxId]
 * @property {string} [paymentTerms]
 * @property {number} balance
 * @property {ContactStatus} status
 */

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} sku
 * @property {string} category
 * @property {number} salesPrice
 * @property {number} costPrice
 * @property {number} taxPercent
 * @property {number} stockQuantity
 * @property {string} uom
 * @property {string} status
 */

/**
 * @typedef {'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'} AccountType
 *
 * @typedef {Object} Account
 * @property {string} id
 * @property {string} code
 * @property {string} name
 * @property {AccountType} type
 * @property {string} currency
 * @property {number} balance
 * @property {boolean} reconcilable
 * @property {string} status
 */

/**
 * @typedef {'SALE' | 'PURCHASE' | 'BANK' | 'CASH' | 'GENERAL'} JournalType
 *
 * @typedef {Object} Journal
 * @property {string} id
 * @property {string} name
 * @property {string} code
 * @property {JournalType} type
 * @property {string} [defaultAccount]
 * @property {string} [shortCode]
 */

/**
 * @typedef {Object} OrderItem
 * @property {string} productId
 * @property {string} productName
 * @property {number} quantity
 * @property {number} unitPrice
 * @property {number} taxPercent
 * @property {number} subtotal
 */

/**
 * @typedef {'QUOTATION' | 'CONFIRMED' | 'DONE' | 'CANCELLED'} SalesOrderStatus
 * @typedef {'NOTHING TO INVOICE' | 'TO INVOICE' | 'FULLY INVOICED'} InvoiceStatus
 *
 * @typedef {Object} SalesOrder
 * @property {string} id
 * @property {string} orderNumber
 * @property {string} customerId
 * @property {string} customerName
 * @property {string} orderDate
 * @property {SalesOrderStatus} status
 * @property {InvoiceStatus} invoiceStatus
 * @property {string} paymentTerms
 * @property {OrderItem[]} items
 * @property {number} subtotal
 * @property {number} tax
 * @property {number} total
 */

/**
 * @typedef {'RFQ' | 'PURCHASE ORDER' | 'CANCELLED'} PurchaseOrderStatus
 * @typedef {'NOTHING TO BILL' | 'WAITING BILLS' | 'FULLY BILLED'} BillStatus
 *
 * @typedef {Object} PurchaseOrder
 * @property {string} id
 * @property {string} orderNumber
 * @property {string} vendorId
 * @property {string} vendorName
 * @property {string} orderDate
 * @property {PurchaseOrderStatus} status
 * @property {BillStatus} billStatus
 * @property {string} paymentTerms
 * @property {OrderItem[]} items
 * @property {number} subtotal
 * @property {number} tax
 * @property {number} total
 */

/**
 * @typedef {'DRAFT' | 'POSTED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED'} InvoiceDocumentStatus
 *
 * @typedef {Object} Invoice
 * @property {string} id
 * @property {string} invoiceNumber
 * @property {string} [salesOrderId]
 * @property {string} customerId
 * @property {string} customerName
 * @property {string} invoiceDate
 * @property {string} dueDate
 * @property {string} paymentTerms
 * @property {InvoiceDocumentStatus} status
 * @property {OrderItem[]} items
 * @property {number} subtotal
 * @property {number} tax
 * @property {number} total
 * @property {number} paid
 * @property {number} outstanding
 */

/**
 * @typedef {Object} VendorBill
 * @property {string} id
 * @property {string} billNumber
 * @property {string} [purchaseOrderId]
 * @property {string} vendorId
 * @property {string} vendorName
 * @property {string} billDate
 * @property {string} dueDate
 * @property {string} paymentTerms
 * @property {InvoiceDocumentStatus} status
 * @property {OrderItem[]} items
 * @property {number} subtotal
 * @property {number} tax
 * @property {number} total
 * @property {number} paid
 * @property {number} outstanding
 */

/**
 * @typedef {'Bank' | 'Cash'} PaymentMethod
 *
 * @typedef {Object} Payment
 * @property {string} id
 * @property {string} paymentNumber
 * @property {'INBOUND' | 'OUTBOUND'} type
 * @property {'INVOICE' | 'BILL'} targetType
 * @property {string} targetId
 * @property {string} targetNumber
 * @property {string} partnerName
 * @property {number} amount
 * @property {PaymentMethod} method
 * @property {string} date
 * @property {string} [memo]
 */
