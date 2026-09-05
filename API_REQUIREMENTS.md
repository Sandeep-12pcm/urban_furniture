# API Requirements Document
**Author:** Member 3 (Frontend & Reports Lead)  
**Recipients:** Member 1 (Auth & Architecture) & Member 2 (Business Logic & Backend Services)  
**Project:** Urban Furniture Accounting System

---

## Overview
The React frontend (Member 3) has completed all UI views, master data management screens, transaction flows (sales orders, purchase orders, customer invoices, vendor bills, payments), executive accounting dashboard, and financial reports (Balance Sheet, Profit & Loss, Budget Utilization).

To complete end-to-end integration without relying on the development adapter fallback, please implement the following endpoints in `apps/api`.

---

## 1. Master Data Endpoints

### API REQUIRED: Contacts
- **METHOD:** `GET`
- **ENDPOINT:** `/api/contacts` (Query param: `?type=CUSTOMER|VENDOR`)
- **REQUEST:** None (Cookie auth)
- **RESPONSE:**
  ```json
  {
    "contacts": [
      {
        "id": "uuid",
        "name": "Horizon Tech Solutions",
        "type": "CUSTOMER",
        "email": "accounting@horizontech.io",
        "phone": "+1 555-234-5678",
        "city": "New York, NY",
        "tax_id": "US-8472910",
        "payment_terms": "30 Days",
        "balance": 5250.00,
        "is_active": true
      }
    ]
  }
  ```
- **WHY:** Required to populate customer/vendor selectors in Sales Orders, Purchase Orders, and the `/contacts` directory.

---

### API REQUIRED: Create Contact
- **METHOD:** `POST`
- **ENDPOINT:** `/api/contacts`
- **REQUEST:**
  ```json
  {
    "name": "Apex Architects",
    "type": "CUSTOMER",
    "email": "finance@apex.com",
    "phone": "+1 555-000-1111",
    "city": "Chicago, IL",
    "taxId": "US-1122334",
    "paymentTerms": "15 Days"
  }
  ```
- **RESPONSE:** `201 Created` with created contact object.
- **WHY:** Allows adding new clients and suppliers from the `/contacts` UI.

---

### API REQUIRED: Products
- **METHOD:** `GET` / `POST` / `PUT /:id` / `DELETE /:id`
- **ENDPOINT:** `/api/products`
- **REQUEST (POST):**
  ```json
  {
    "name": "Executive Mahogany Desk",
    "sku": "DESK-MAH-01",
    "category": "Desks & Workstations",
    "salesPrice": 1250.00,
    "costPrice": 650.00,
    "taxPercent": 10,
    "stockQuantity": 24,
    "uom": "Units"
  }
  ```
- **RESPONSE:** Array / single product object.
- **WHY:** Required to populate order line dropdowns with pricing and stock quantities.

---

### API REQUIRED: Chart of Accounts
- **METHOD:** `GET` / `POST` / `PUT /:id`
- **ENDPOINT:** `/api/accounts`
- **REQUEST (POST):**
  ```json
  {
    "code": "101000",
    "name": "Cash on Hand",
    "type": "ASSET",
    "currency": "USD",
    "balance": 18450.00,
    "reconcilable": true
  }
  ```
- **RESPONSE:** Array / single account object.
- **WHY:** Core general ledger accounts for journal entries and balance sheet.

---

### API REQUIRED: Journals
- **METHOD:** `GET` / `POST` / `PUT /:id`
- **ENDPOINT:** `/api/journals`
- **RESPONSE:** List of journals (Customer Invoices, Vendor Bills, Bank, Cash).
- **WHY:** Needed to route transactions to appropriate ledgers.

---

### API REQUIRED: Analytic Accounts (Cost Centers)
- **METHOD:** `GET` / `POST` / `PUT /:id`
- **ENDPOINT:** `/api/analytic-accounts`
- **REQUEST:**
  ```json
  {
    "name": "HQ Showroom Remodel",
    "code": "AA-SHOWROOM",
    "partner": "Internal",
    "budget": 50000.00
  }
  ```
- **RESPONSE:** Array / single analytic account object.
- **WHY:** Required for project and departmental cost accounting.

---

### API REQUIRED: Budgets
- **METHOD:** `GET` / `POST` / `PUT /:id`
- **ENDPOINT:** `/api/budgets`
- **REQUEST:**
  ```json
  {
    "name": "FY2026 Commercial Budget",
    "dateFrom": "2026-01-01",
    "dateTo": "2026-12-31",
    "lines": [
      {
        "name": "Office Rent",
        "account": "600000",
        "plannedAmount": 36000.00,
        "practicalAmount": 18000.00
      }
    ]
  }
  ```
- **RESPONSE:** Budget with lines and total utilization.
- **WHY:** Required for fiscal monitoring and Budget Variance report.

---

## 2. Sales Orders Endpoints

### API REQUIRED: Sales Orders List & Create
- **METHOD:** `GET` / `POST`
- **ENDPOINT:** `/api/sales-orders`
- **REQUEST (POST):**
  ```json
  {
    "customerId": "uuid",
    "customerName": "Horizon Tech Solutions",
    "orderDate": "2026-02-15",
    "paymentTerms": "30 Days",
    "status": "CONFIRMED",
    "items": [
      {
        "productId": "uuid",
        "productName": "Executive Desk",
        "quantity": 4,
        "unitPrice": 1250.00,
        "taxPercent": 10,
        "subtotal": 5000.00
      }
    ],
    "subtotal": 5000.00,
    "tax": 500.00,
    "total": 5500.00
  }
  ```
- **RESPONSE:** Created sales order with auto-generated order number (e.g. `SO/2026/0001`).
- **WHY:** Primary sales workflow from quote to confirmed sales order.

---

### API REQUIRED: Confirm Sales Order
- **METHOD:** `POST`
- **ENDPOINT:** `/api/sales-orders/:id/confirm`
- **RESPONSE:** Updated sales order with `status: "CONFIRMED"` and `invoiceStatus: "TO INVOICE"`.
- **WHY:** Moves quotation to official confirmed customer commitment.

---

### API REQUIRED: Convert Sales Order to Customer Invoice
- **METHOD:** `POST`
- **ENDPOINT:** `/api/sales-orders/:id/create-invoice`
- **RESPONSE:** Created customer invoice (`INV/2026/0001`) with items copied from order.
- **WHY:** Odoo-style automated one-click invoicing from sales orders.

---

## 3. Purchase Orders Endpoints

### API REQUIRED: Purchase Orders List & Create
- **METHOD:** `GET` / `POST`
- **ENDPOINT:** `/api/purchase-orders`
- **REQUEST (POST):**
  ```json
  {
    "vendorId": "uuid",
    "vendorName": "TimberCraft Suppliers",
    "orderDate": "2026-02-10",
    "paymentTerms": "30 Days",
    "status": "PURCHASE ORDER",
    "items": [
      {
        "productId": "uuid",
        "productName": "Hardwood Slab",
        "quantity": 10,
        "unitPrice": 650.00,
        "subtotal": 6500.00
      }
    ],
    "subtotal": 6500.00,
    "total": 6500.00
  }
  ```
- **RESPONSE:** Created PO object (e.g. `PO/2026/0001`).
- **WHY:** Procurement workflow from RFQ to purchase confirmation.

---

### API REQUIRED: Convert Purchase Order to Vendor Bill
- **METHOD:** `POST`
- **ENDPOINT:** `/api/purchase-orders/:id/convert-to-bill`
- **RESPONSE:** Created vendor bill (`BILL/2026/0001`).
- **WHY:** Creates account payable and updates PO billing status to `FULLY BILLED`.

---

## 4. Invoices & Vendor Bills Endpoints

### API REQUIRED: Customer Invoices
- **METHOD:** `GET` / `POST` / `GET /:id` / `POST /:id/post`
- **ENDPOINT:** `/api/invoices`
- **RESPONSE:** Invoice with `total`, `paid`, `outstanding`, `status` (`DRAFT`, `POSTED`, `PAID`, `PARTIALLY_PAID`).
- **WHY:** Receivables ledger management.

---

### API REQUIRED: Vendor Bills
- **METHOD:** `GET` / `POST` / `GET /:id` / `POST /:id/post`
- **ENDPOINT:** `/api/vendor-bills`
- **RESPONSE:** Vendor bill with `total`, `paid`, `outstanding`, `status`.
- **WHY:** Payables ledger management.

---

## 5. Payments Endpoints

### API REQUIRED: Register Payment
- **METHOD:** `POST`
- **ENDPOINT:** `/api/payments`
- **REQUEST:**
  ```json
  {
    "targetType": "INVOICE",
    "targetId": "uuid-invoice",
    "amount": 3000.00,
    "method": "Bank",
    "date": "2026-02-23",
    "memo": "Check #4029 deposit"
  }
  ```
- **RESPONSE:**
  ```json
  {
    "payment": {
      "id": "uuid",
      "paymentNumber": "PAY/2026/0001",
      "type": "INBOUND",
      "amount": 3000.00,
      "method": "Bank",
      "date": "2026-02-23"
    }
  }
  ```
- **WHY:** Automatically credits/debits the invoice/bill, updates outstanding balance, transitions status to `PAID` or `PARTIALLY_PAID`, and logs general ledger entries.

---

## 6. Financial Reports & Dashboard Endpoints

### API REQUIRED: Executive Dashboard KPIs
- **METHOD:** `GET`
- **ENDPOINT:** `/api/reports/dashboard`
- **RESPONSE:**
  ```json
  {
    "totalSales": 182400.00,
    "totalPurchases": 94500.00,
    "receivables": 46200.00,
    "payables": 29650.00,
    "cashBankBalance": 143250.00,
    "netProfit": 87900.00,
    "budgetUtilization": 61,
    "revenueMonthly": [
      { "month": "Oct", "sales": 42000, "purchases": 26000 },
      { "month": "Nov", "sales": 51000, "purchases": 32000 },
      { "month": "Dec", "sales": 68000, "purchases": 41000 },
      { "month": "Jan", "sales": 48000, "purchases": 29000 },
      { "month": "Feb", "sales": 58000, "purchases": 34000 },
      { "month": "Mar", "sales": 64000, "purchases": 38000 }
    ]
  }
  ```
- **WHY:** Powers top-level executive metrics on `/dashboard`.

---

### API REQUIRED: Balance Sheet Report
- **METHOD:** `GET`
- **ENDPOINT:** `/api/reports/balance-sheet?asOf=YYYY-MM-DD`
- **RESPONSE:**
  ```json
  {
    "asOfDate": "2026-03-05",
    "assets": [{ "code": "101000", "name": "Cash on Hand", "amount": 18450.00 }],
    "totalAssets": 442850.00,
    "liabilities": [{ "code": "200000", "name": "Accounts Payable", "amount": 29650.00 }],
    "totalLiabilities": 86450.00,
    "equity": [{ "code": "300000", "name": "Common Stock", "amount": 200000.00 }],
    "totalEquity": 356400.00,
    "totalLiabilitiesAndEquity": 442850.00,
    "isBalanced": true
  }
  ```
- **WHY:** Standard Balance Sheet statement.

---

### API REQUIRED: Profit & Loss Statement
- **METHOD:** `GET`
- **ENDPOINT:** `/api/reports/profit-loss?period=YYYY-MM-DD`
- **RESPONSE:**
  ```json
  {
    "period": "2026-YTD",
    "income": [{ "code": "400000", "name": "Sales Revenue", "amount": 182400.00 }],
    "totalIncome": 206900.00,
    "cogs": [{ "code": "500000", "name": "Direct Material", "amount": 76000.00 }],
    "totalCogs": 94500.00,
    "grossProfit": 112400.00,
    "expenses": [{ "code": "600000", "name": "Rent", "amount": 18000.00 }],
    "totalExpenses": 67500.00,
    "netProfit": 44900.00,
    "netProfitMargin": 21.7
  }
  ```
- **WHY:** Standard Profit & Loss statement.

---

### API REQUIRED: Budget Utilization Report
- **METHOD:** `GET`
- **ENDPOINT:** `/api/reports/budget?budgetId=uuid`
- **RESPONSE:**
  ```json
  {
    "name": "FY2026 Operating Budget",
    "dateFrom": "2026-01-01",
    "dateTo": "2026-12-31",
    "totalPlanned": 196000.00,
    "totalPractical": 120600.00,
    "totalRemaining": 75400.00,
    "overallUtilization": 61,
    "lines": [
      {
        "name": "Office Rent",
        "account": "600000",
        "plannedAmount": 36000.00,
        "practicalAmount": 18000.00,
        "remaining": 18000.00,
        "utilization": 50
      }
    ]
  }
  ```
- **WHY:** Powers `/reports/budget` tracking.
