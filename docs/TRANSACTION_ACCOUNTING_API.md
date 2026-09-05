# Urban Furniture Accounting System - Member 2 API Documentation

## Overview
This document specifies the transaction and double-entry accounting API implemented by **Member 2**.
All operations are executed within atomic database transactions (`prisma.$transaction`) ensuring that unbalanced or partial states can never occur.

---

## 1. Accounting Principles & Invariants

### 1.1 Double-Entry Balance Rule
Every financial posting (Customer Invoice, Vendor Bill, or Payment) generates a `JournalEntry` and balanced `JournalItem` records where:
$$\sum \text{Debit} = \sum \text{Credit} > 0$$
Any transaction attempting to create an unbalanced entry is strictly rejected with an error.

### 1.2 Account Normal Balances & Updates
- **ASSET / EXPENSE** accounts: `balance_delta = debit - credit`
- **LIABILITY / EQUITY / REVENUE** accounts: `balance_delta = credit - debit`
Account `currentBalance` is adjusted automatically and atomically upon entry posting.

### 1.3 System Accounts & Journals
- `INV` (Customer Invoices, SALE): Default Debit `103000` (Accounts Receivable), Default Credit `401000` (Sales Revenue)
- `BILL` (Vendor Bills, PURCHASE): Default Debit `501000` (Cost of Goods Sold), Default Credit `201000` (Accounts Payable)
- `BNK` (Bank, BANK): Default Debit & Credit `102000` (Primary Bank Account)
- `CSH` (Cash, CASH): Default Debit & Credit `101000` (Cash in Hand)

---

## 2. API Endpoints

### 2.1 Purchase Orders (`/api/purchase-orders`)
- `POST /api/purchase-orders` - Create draft Purchase Order
- `GET /api/purchase-orders` - List purchase orders (filters: `status`, `vendorId`, `search`)
- `GET /api/purchase-orders/:id` - Retrieve single purchase order
- `PUT /api/purchase-orders/:id` - Update status or items (`DRAFT` -> `SENT` -> `CONFIRMED` -> `CANCELLED`)
- `POST /api/purchase-orders/:id/convert-to-bill` - Convert confirmed PO to Vendor Bill

#### Request Example (Create PO):
```json
POST /api/purchase-orders
{
  "vendorId": "uuid-vendor-id",
  "expectedDate": "2026-10-15",
  "notes": "Raw wood supply",
  "items": [
    {
      "productId": "uuid-product-id",
      "quantity": 10,
      "unitPrice": 500.00,
      "taxRate": 18
    }
  ]
}
```

---

### 2.2 Vendor Bills (`/api/vendor-bills`)
- `POST /api/vendor-bills` - Create vendor bill (status: `DRAFT`, or `POSTED` if `autoPost: true`)
- `GET /api/vendor-bills` - List vendor bills (filters: `status`, `vendorId`, `search`)
- `GET /api/vendor-bills/:id` - Retrieve vendor bill details
- `POST /api/vendor-bills/:id/post` - Post bill and generate double-entry journal entry:
  - **Debit**: Cost of Goods Sold / Expense (`501000`)
  - **Credit**: Accounts Payable (`201000`)
- `POST /api/vendor-bills/:id/payment` - Register payment against vendor bill:
  - **Debit**: Accounts Payable (`201000`)
  - **Credit**: Cash (`101000`) or Bank (`102000`)

#### Request Example (Register Bill Payment):
```json
POST /api/vendor-bills/:id/payment
{
  "amount": 2500.00,
  "paymentMethod": "BANK",
  "paymentDate": "2026-09-05"
}
```

---

### 2.3 Sales Orders (`/api/sales-orders`)
- `POST /api/sales-orders` - Create draft Sales Order (server-calculated subtotal, tax, grand total)
- `GET /api/sales-orders` - List sales orders (filters: `status`, `customerId`, `search`)
- `GET /api/sales-orders/:id` - Retrieve sales order details
- `PUT /api/sales-orders/:id` - Update sales order (`DRAFT` -> `SENT` -> `CONFIRMED` -> `CANCELLED`)
- `POST /api/sales-orders/:id/convert-to-invoice` - Convert confirmed SO to Customer Invoice

#### Request Example (Create SO):
```json
POST /api/sales-orders
{
  "customerId": "uuid-customer-id",
  "commitmentDate": "2026-09-20",
  "notes": "Office furniture order",
  "items": [
    {
      "productId": "uuid-product-id",
      "quantity": 5,
      "unitPrice": 1200.00,
      "taxRate": 18
    }
  ]
}
```

---

### 2.4 Customer Invoices (`/api/invoices`)
- `POST /api/invoices` - Create customer invoice (`DRAFT` or `POSTED` if `autoPost: true`)
- `GET /api/invoices` - List customer invoices with `amountPaid` and `amountDue`
- `GET /api/invoices/:id` - Retrieve customer invoice
- `POST /api/invoices/:id/post` - Post invoice and generate double-entry journal entry:
  - **Debit**: Accounts Receivable (`103000`)
  - **Credit**: Sales Revenue (`401000`)
- `POST /api/invoices/:id/payment` - Register receipt against invoice:
  - **Debit**: Cash (`101000`) or Bank (`102000`)
  - **Credit**: Accounts Receivable (`103000`)

#### Request Example (Register Customer Receipt):
```json
POST /api/invoices/:id/payment
{
  "amount": 3000.00,
  "paymentMethod": "CASH",
  "paymentDate": "2026-09-05"
}
```

---

### 2.5 Payments (`/api/payments`)
- `POST /api/payments` - Record payment (inbound or outbound, linked to invoice, bill, or direct)
- `GET /api/payments` - List payments with linked relations
- `GET /api/payments/:id` - Retrieve payment details

---

### 2.6 Journal Entries Query (`/api/journal-entries`)
- `GET /api/journal-entries` - Inspect balanced double-entry records
- `GET /api/journal-entries/:id` - Retrieve journal entry with items and accounts

---

## 3. Standard Response Formats

### Success Response:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully."
}
```

### Error Response:
```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": ["Payment amount cannot exceed outstanding amount."]
}
```
