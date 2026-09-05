-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ACCOUNTANT', 'CONTACT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('CUSTOMER', 'VENDOR', 'BOTH');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('STORABLE', 'CONSUMABLE', 'SERVICE');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('SALE', 'PURCHASE', 'CASH', 'BANK', 'GENERAL');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'POSTED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'SENT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('CUSTOMER', 'VENDOR');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('DRAFT', 'POSTED', 'RECONCILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "login_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ACCOUNTANT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "last_login_at" TIMESTAMP(3),
    "contact_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ContactType" NOT NULL DEFAULT 'CUSTOMER',
    "email" TEXT,
    "phone" TEXT,
    "tax_id" TEXT,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT DEFAULT 'India',
    "is_company" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "current_balance" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journals" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "JournalType" NOT NULL,
    "default_debit_account_id" TEXT,
    "default_credit_account_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sales_price" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "cost_price" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "type" "ProductType" NOT NULL DEFAULT 'STORABLE',
    "uom" TEXT NOT NULL DEFAULT 'Units',
    "sales_account_id" TEXT,
    "expense_account_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytic_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytic_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date_from" TIMESTAMP(3) NOT NULL,
    "date_to" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_items" (
    "id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "analytic_account_id" TEXT,
    "account_id" TEXT,
    "planned_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "practical_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "entry_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "journal_id" TEXT NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'DRAFT',
    "posted_at" TIMESTAMP(3),
    "total_debit" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "total_credit" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "invoice_id" TEXT,
    "bill_id" TEXT,
    "payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_items" (
    "id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "analytic_account_id" TEXT,
    "label" TEXT,
    "debit" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "credit" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "due_date" TIMESTAMP(3),
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_date" TIMESTAMP(3),
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "untaxed_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    "unit_price" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_bills" (
    "id" TEXT NOT NULL,
    "bill_number" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "purchase_order_id" TEXT,
    "journal_id" TEXT,
    "bill_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "reference" TEXT,
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "untaxed_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "amount_due" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_bill_items" (
    "id" TEXT NOT NULL,
    "vendor_bill_id" TEXT NOT NULL,
    "product_id" TEXT,
    "account_id" TEXT,
    "analytic_account_id" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    "unit_price" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_bill_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commitment_date" TIMESTAMP(3),
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "untaxed_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    "unit_price" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sales_order_id" TEXT,
    "journal_id" TEXT,
    "invoice_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "reference" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "untaxed_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "amount_due" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_invoice_items" (
    "id" TEXT NOT NULL,
    "customer_invoice_id" TEXT NOT NULL,
    "product_id" TEXT,
    "account_id" TEXT,
    "analytic_account_id" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    "unit_price" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "payment_number" TEXT NOT NULL,
    "payment_type" "PaymentType" NOT NULL DEFAULT 'INBOUND',
    "partner_type" "PartnerType" NOT NULL DEFAULT 'CUSTOMER',
    "contact_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'BANK',
    "journal_id" TEXT,
    "invoice_id" TEXT,
    "bill_id" TEXT,
    "memo" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_id_key" ON "users"("login_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_contact_id_idx" ON "users"("contact_id");

-- CreateIndex
CREATE INDEX "contacts_type_idx" ON "contacts"("type");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_code_key" ON "accounts"("code");

-- CreateIndex
CREATE INDEX "accounts_type_idx" ON "accounts"("type");

-- CreateIndex
CREATE INDEX "accounts_code_idx" ON "accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "journals_code_key" ON "journals"("code");

-- CreateIndex
CREATE INDEX "journals_type_idx" ON "journals"("type");

-- CreateIndex
CREATE INDEX "journals_code_idx" ON "journals"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_code_idx" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_type_idx" ON "products"("type");

-- CreateIndex
CREATE UNIQUE INDEX "analytic_accounts_code_key" ON "analytic_accounts"("code");

-- CreateIndex
CREATE INDEX "analytic_accounts_code_idx" ON "analytic_accounts"("code");

-- CreateIndex
CREATE INDEX "budgets_date_from_date_to_idx" ON "budgets"("date_from", "date_to");

-- CreateIndex
CREATE INDEX "budget_items_budget_id_idx" ON "budget_items"("budget_id");

-- CreateIndex
CREATE INDEX "budget_items_analytic_account_id_idx" ON "budget_items"("analytic_account_id");

-- CreateIndex
CREATE INDEX "budget_items_account_id_idx" ON "budget_items"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_entry_number_key" ON "journal_entries"("entry_number");

-- CreateIndex
CREATE INDEX "journal_entries_entry_number_idx" ON "journal_entries"("entry_number");

-- CreateIndex
CREATE INDEX "journal_entries_journal_id_idx" ON "journal_entries"("journal_id");

-- CreateIndex
CREATE INDEX "journal_entries_status_idx" ON "journal_entries"("status");

-- CreateIndex
CREATE INDEX "journal_entries_date_idx" ON "journal_entries"("date");

-- CreateIndex
CREATE INDEX "journal_items_journal_entry_id_idx" ON "journal_items"("journal_entry_id");

-- CreateIndex
CREATE INDEX "journal_items_account_id_idx" ON "journal_items"("account_id");

-- CreateIndex
CREATE INDEX "journal_items_contact_id_idx" ON "journal_items"("contact_id");

-- CreateIndex
CREATE INDEX "journal_items_analytic_account_id_idx" ON "journal_items"("analytic_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_order_number_key" ON "purchase_orders"("order_number");

-- CreateIndex
CREATE INDEX "purchase_orders_order_number_idx" ON "purchase_orders"("order_number");

-- CreateIndex
CREATE INDEX "purchase_orders_vendor_id_idx" ON "purchase_orders"("vendor_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_product_id_idx" ON "purchase_order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_bills_bill_number_key" ON "vendor_bills"("bill_number");

-- CreateIndex
CREATE INDEX "vendor_bills_bill_number_idx" ON "vendor_bills"("bill_number");

-- CreateIndex
CREATE INDEX "vendor_bills_vendor_id_idx" ON "vendor_bills"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_bills_status_idx" ON "vendor_bills"("status");

-- CreateIndex
CREATE INDEX "vendor_bill_items_vendor_bill_id_idx" ON "vendor_bill_items"("vendor_bill_id");

-- CreateIndex
CREATE INDEX "vendor_bill_items_product_id_idx" ON "vendor_bill_items"("product_id");

-- CreateIndex
CREATE INDEX "vendor_bill_items_account_id_idx" ON "vendor_bill_items"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_order_number_key" ON "sales_orders"("order_number");

-- CreateIndex
CREATE INDEX "sales_orders_order_number_idx" ON "sales_orders"("order_number");

-- CreateIndex
CREATE INDEX "sales_orders_customer_id_idx" ON "sales_orders"("customer_id");

-- CreateIndex
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

-- CreateIndex
CREATE INDEX "sales_order_items_sales_order_id_idx" ON "sales_order_items"("sales_order_id");

-- CreateIndex
CREATE INDEX "sales_order_items_product_id_idx" ON "sales_order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_invoices_invoice_number_key" ON "customer_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "customer_invoices_invoice_number_idx" ON "customer_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "customer_invoices_customer_id_idx" ON "customer_invoices"("customer_id");

-- CreateIndex
CREATE INDEX "customer_invoices_status_idx" ON "customer_invoices"("status");

-- CreateIndex
CREATE INDEX "customer_invoice_items_customer_invoice_id_idx" ON "customer_invoice_items"("customer_invoice_id");

-- CreateIndex
CREATE INDEX "customer_invoice_items_product_id_idx" ON "customer_invoice_items"("product_id");

-- CreateIndex
CREATE INDEX "customer_invoice_items_account_id_idx" ON "customer_invoice_items"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_payment_number_key" ON "payments"("payment_number");

-- CreateIndex
CREATE INDEX "payments_payment_number_idx" ON "payments"("payment_number");

-- CreateIndex
CREATE INDEX "payments_contact_id_idx" ON "payments"("contact_id");

-- CreateIndex
CREATE INDEX "payments_payment_type_idx" ON "payments"("payment_type");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_default_debit_account_id_fkey" FOREIGN KEY ("default_debit_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_default_credit_account_id_fkey" FOREIGN KEY ("default_credit_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_sales_account_id_fkey" FOREIGN KEY ("sales_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_analytic_account_id_fkey" FOREIGN KEY ("analytic_account_id") REFERENCES "analytic_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_items" ADD CONSTRAINT "journal_items_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_items" ADD CONSTRAINT "journal_items_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_items" ADD CONSTRAINT "journal_items_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_items" ADD CONSTRAINT "journal_items_analytic_account_id_fkey" FOREIGN KEY ("analytic_account_id") REFERENCES "analytic_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_items" ADD CONSTRAINT "vendor_bill_items_vendor_bill_id_fkey" FOREIGN KEY ("vendor_bill_id") REFERENCES "vendor_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_items" ADD CONSTRAINT "vendor_bill_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_items" ADD CONSTRAINT "vendor_bill_items_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_items" ADD CONSTRAINT "vendor_bill_items_analytic_account_id_fkey" FOREIGN KEY ("analytic_account_id") REFERENCES "analytic_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoice_items" ADD CONSTRAINT "customer_invoice_items_customer_invoice_id_fkey" FOREIGN KEY ("customer_invoice_id") REFERENCES "customer_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoice_items" ADD CONSTRAINT "customer_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoice_items" ADD CONSTRAINT "customer_invoice_items_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoice_items" ADD CONSTRAINT "customer_invoice_items_analytic_account_id_fkey" FOREIGN KEY ("analytic_account_id") REFERENCES "analytic_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "customer_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "vendor_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
