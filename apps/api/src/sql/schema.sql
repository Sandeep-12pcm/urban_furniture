CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  login_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'ACCOUNTANT', 'CONTACT')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  contact_id TEXT NULL,
  account_type TEXT NULL CHECK (account_type IN ('CUSTOMER', 'VENDOR') OR account_type IS NULL),
  approval_status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_at TIMESTAMPTZ NULL,
  approved_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_contact_id ON users(contact_id);

-- Historical note: contact_id started as TEXT before the Contact Master
-- existed. It is converted to a proper UUID foreign key further below, once
-- the `contacts` table is defined, so no unconditional TEXT cast happens here.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_account_type_check,
  ADD CONSTRAINT users_account_type_check CHECK (account_type IN ('CUSTOMER', 'VENDOR') OR account_type IS NULL);

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_approval_status_check,
  ADD CONSTRAINT users_approval_status_check CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID NULL,
  metadata JSONB NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- ============================================================
-- PHASE 1: MASTER DATA
-- ============================================================

-- 1.1 Contact Master ------------------------------------------------------

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('CUSTOMER', 'VENDOR', 'BOTH')),
  email TEXT NULL,
  mobile TEXT NULL,
  city TEXT NULL,
  state TEXT NULL,
  pincode TEXT NULL,
  profile_image_url TEXT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts (lower(name));
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (lower(email));
CREATE INDEX IF NOT EXISTS idx_contacts_mobile ON contacts (mobile);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts (type);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts (status);

-- Link a User to a Contact for the future Contact Portal (one-to-one).
-- The users.contact_id column already exists as TEXT from the auth module;
-- convert it to a proper UUID foreign key now that contacts exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'contact_id' AND data_type <> 'uuid'
  ) THEN
    UPDATE users SET contact_id = NULL
      WHERE contact_id IS NOT NULL
        AND contact_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    ALTER TABLE users ALTER COLUMN contact_id TYPE UUID USING contact_id::uuid;
  END IF;
END $$;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_contact_id_fkey,
  ADD CONSTRAINT users_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_contact_id_unique ON users (contact_id) WHERE contact_id IS NOT NULL;

-- 1.2 Product Categories ---------------------------------------------------

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_name_unique ON product_categories (lower(name));
CREATE INDEX IF NOT EXISTS idx_product_categories_status ON product_categories (status);

-- 1.3 Product Master --------------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('GOODS', 'SERVICE', 'COMBO')),
  sales_price NUMERIC(14, 2) NOT NULL CHECK (sales_price >= 0),
  purchase_price NUMERIC(14, 2) NOT NULL CHECK (purchase_price >= 0),
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products (lower(name));
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON products (type);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);

-- 1.4 Chart of Accounts ------------------------------------------------------

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EXPENSE', 'INCOME', 'CAPITAL')),
  description TEXT NULL,
  parent_account_id UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_code_unique ON accounts (account_code);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts (type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts (parent_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts (status);

-- 1.5 Journals ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS journals (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('SALES', 'PURCHASE', 'BANK', 'CASH')),
  default_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journals_name_unique ON journals (lower(name));
CREATE INDEX IF NOT EXISTS idx_journals_type ON journals (type);
CREATE INDEX IF NOT EXISTS idx_journals_status ON journals (status);
CREATE INDEX IF NOT EXISTS idx_journals_default_account ON journals (default_account_id);

-- 1.6 Analytic Accounts ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS analytic_accounts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytic_accounts_name_unique ON analytic_accounts (lower(name));
CREATE INDEX IF NOT EXISTS idx_analytic_accounts_type ON analytic_accounts (type);
CREATE INDEX IF NOT EXISTS idx_analytic_accounts_status ON analytic_accounts (status);

-- 1.7 Budget ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  planned_amount NUMERIC(14, 2) NOT NULL CHECK (planned_amount >= 0),
  responsible_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  analytic_account_id UUID NOT NULL REFERENCES analytic_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL,
  CONSTRAINT budgets_period_valid CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_budgets_name ON budgets (lower(name));
CREATE INDEX IF NOT EXISTS idx_budgets_analytic_account ON budgets (analytic_account_id);
CREATE INDEX IF NOT EXISTS idx_budgets_responsible_user ON budgets (responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets (status);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets (period_start, period_end);

-- ============================================================
-- PHASE 2: ACCOUNTING ENGINE
-- The journal entry header and its lines are the accounting source of truth.
-- Ledger and balance views are always derived from posted lines.
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY,
  entry_number TEXT NOT NULL UNIQUE,
  journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
  entry_date DATE NOT NULL,
  reference TEXT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  posted_by_id UUID NULL REFERENCES users(id) ON DELETE RESTRICT,
  posted_at TIMESTAMPTZ NULL,
  cancelled_by_id UUID NULL REFERENCES users(id) ON DELETE RESTRICT,
  cancelled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE SEQUENCE IF NOT EXISTS journal_entry_number_seq START 1;
CREATE INDEX IF NOT EXISTS idx_journal_entries_journal ON journal_entries(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  description TEXT NULL,
  debit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  analytic_account_id UUID NULL REFERENCES analytic_accounts(id) ON DELETE RESTRICT,
  line_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT journal_entry_line_one_side CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_analytic ON journal_entry_lines(analytic_account_id);

-- PHASE 3: PURCHASE MANAGEMENT. Amounts are authoritative NUMERIC values;
-- totals are calculated server-side from the item rows.
CREATE SEQUENCE IF NOT EXISTS purchase_order_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS vendor_bill_number_seq START 1;
CREATE TABLE IF NOT EXISTS purchase_orders (
 id UUID PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, vendor_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
 order_date DATE NOT NULL, expected_date DATE NULL, reference TEXT NULL, notes TEXT NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','CONFIRMED','CANCELLED')),
 subtotal NUMERIC(14,2) NOT NULL DEFAULT 0, tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0, total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
 created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, confirmed_by_id UUID NULL REFERENCES users(id) ON DELETE RESTRICT, confirmed_at TIMESTAMPTZ NULL,
 cancelled_by_id UUID NULL REFERENCES users(id) ON DELETE RESTRICT, cancelled_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(expected_date IS NULL OR expected_date >= order_date)
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON purchase_orders(vendor_id); CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status); CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(order_date);
CREATE TABLE IF NOT EXISTS purchase_order_items (
 id UUID PRIMARY KEY,purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,description TEXT NULL,
 quantity NUMERIC(14,2) NOT NULL CHECK(quantity>0),unit_price NUMERIC(14,2) NOT NULL CHECK(unit_price>=0),tax_rate NUMERIC(5,2) NOT NULL CHECK(tax_rate IN (0,5,12,18,28)),tax_amount NUMERIC(14,2) NOT NULL,line_subtotal NUMERIC(14,2) NOT NULL,line_total NUMERIC(14,2) NOT NULL,line_order INTEGER NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(purchase_order_id); CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON purchase_order_items(product_id);
CREATE TABLE IF NOT EXISTS vendor_bills (
 id UUID PRIMARY KEY,bill_number TEXT NOT NULL UNIQUE,vendor_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,purchase_order_id UUID NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
 vendor_invoice_number TEXT NULL,invoice_date DATE NOT NULL,due_date DATE NOT NULL,reference TEXT NULL,notes TEXT NULL,
 subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
 payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(payment_status IN ('UNPAID','PARTIALLY_PAID','PAID','OVERDUE')),status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED','CANCELLED')),
 created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,posted_by_id UUID NULL REFERENCES users(id) ON DELETE RESTRICT,posted_at TIMESTAMPTZ NULL,accounting_entry_id UUID NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CHECK(due_date>=invoice_date));
CREATE INDEX IF NOT EXISTS idx_vendor_bills_vendor ON vendor_bills(vendor_id); CREATE INDEX IF NOT EXISTS idx_vendor_bills_purchase_order ON vendor_bills(purchase_order_id); CREATE INDEX IF NOT EXISTS idx_vendor_bills_status ON vendor_bills(status); CREATE INDEX IF NOT EXISTS idx_vendor_bills_invoice ON vendor_bills(vendor_invoice_number);
CREATE TABLE IF NOT EXISTS vendor_bill_items (
 id UUID PRIMARY KEY,vendor_bill_id UUID NOT NULL REFERENCES vendor_bills(id) ON DELETE CASCADE,purchase_order_item_id UUID NULL REFERENCES purchase_order_items(id) ON DELETE RESTRICT,product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,description TEXT NULL,
 quantity NUMERIC(14,2) NOT NULL CHECK(quantity>0),unit_price NUMERIC(14,2) NOT NULL CHECK(unit_price>=0),tax_rate NUMERIC(5,2) NOT NULL CHECK(tax_rate IN (0,5,12,18,28)),tax_amount NUMERIC(14,2) NOT NULL,line_subtotal NUMERIC(14,2) NOT NULL,line_total NUMERIC(14,2) NOT NULL,line_order INTEGER NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_vendor_bill_items_bill ON vendor_bill_items(vendor_bill_id); CREATE INDEX IF NOT EXISTS idx_vendor_bill_items_product ON vendor_bill_items(product_id);

CREATE SEQUENCE IF NOT EXISTS sales_order_number_seq START 1; CREATE SEQUENCE IF NOT EXISTS customer_invoice_number_seq START 1;
CREATE TABLE IF NOT EXISTS sales_orders (id UUID PRIMARY KEY,order_number TEXT NOT NULL UNIQUE,customer_id UUID NOT NULL REFERENCES contacts(id),order_date DATE NOT NULL,expected_date DATE,reference TEXT,notes TEXT,status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','CONFIRMED','CANCELLED')),subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,created_by_id UUID NOT NULL REFERENCES users(id),confirmed_by_id UUID REFERENCES users(id),confirmed_at TIMESTAMPTZ,cancelled_by_id UUID REFERENCES users(id),cancelled_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS sales_order_items (id UUID PRIMARY KEY,sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,product_id UUID NOT NULL REFERENCES products(id),description TEXT,quantity NUMERIC(14,2) NOT NULL CHECK(quantity>0),unit_price NUMERIC(14,2) NOT NULL CHECK(unit_price>=0),tax_rate NUMERIC(5,2) NOT NULL CHECK(tax_rate IN (0,5,12,18,28)),tax_amount NUMERIC(14,2) NOT NULL,line_subtotal NUMERIC(14,2) NOT NULL,line_total NUMERIC(14,2) NOT NULL,line_order INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS customer_invoices (id UUID PRIMARY KEY,invoice_number TEXT NOT NULL UNIQUE,customer_id UUID NOT NULL REFERENCES contacts(id),sales_order_id UUID REFERENCES sales_orders(id),invoice_date DATE NOT NULL,due_date DATE NOT NULL,reference TEXT,notes TEXT,subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED','CANCELLED')),payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(payment_status IN ('UNPAID','PARTIALLY_PAID','PAID','OVERDUE')),created_by_id UUID NOT NULL REFERENCES users(id),posted_by_id UUID REFERENCES users(id),posted_at TIMESTAMPTZ,accounting_entry_id UUID UNIQUE REFERENCES journal_entries(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CHECK(due_date>=invoice_date));
CREATE TABLE IF NOT EXISTS customer_invoice_items (id UUID PRIMARY KEY,customer_invoice_id UUID NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,product_id UUID NOT NULL REFERENCES products(id),description TEXT,quantity NUMERIC(14,2) NOT NULL CHECK(quantity>0),unit_price NUMERIC(14,2) NOT NULL CHECK(unit_price>=0),tax_rate NUMERIC(5,2) NOT NULL CHECK(tax_rate IN (0,5,12,18,28)),tax_amount NUMERIC(14,2) NOT NULL,line_subtotal NUMERIC(14,2) NOT NULL,line_total NUMERIC(14,2) NOT NULL,line_order INTEGER NOT NULL);

-- ============================================================
-- PHASE 5: PAYMENTS
-- Every payment is recorded and posted atomically (record -> balanced
-- journal entry -> posted, in one flow) rather than having its own
-- draft/post lifecycle. Cancelling a payment never mutates the original
-- posted journal entry; it posts a reversing entry instead, so the
-- accounting trail is never rewritten after the fact.
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS payment_number_seq START 1;
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY,
  payment_number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('CUSTOMER', 'VENDOR')),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  customer_invoice_id UUID NULL REFERENCES customer_invoices(id) ON DELETE RESTRICT,
  vendor_bill_id UUID NULL REFERENCES vendor_bills(id) ON DELETE RESTRICT,
  payment_date DATE NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('CASH', 'BANK')),
  reference TEXT NULL,
  notes TEXT NULL,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'CANCELLED')),
  accounting_entry_id UUID NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
  reversal_entry_id UUID NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cancelled_by_id UUID NULL REFERENCES users(id) ON DELETE RESTRICT,
  cancelled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_target_matches_type CHECK (
    (type = 'CUSTOMER' AND customer_invoice_id IS NOT NULL AND vendor_bill_id IS NULL) OR
    (type = 'VENDOR' AND vendor_bill_id IS NOT NULL AND customer_invoice_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_payments_customer_invoice ON payments(customer_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_vendor_bill ON payments(vendor_bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_contact ON payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);

-- ============================================================
-- PHASE 6: INVENTORY. inventory_movements is the immutable stock ledger;
-- inventory_stock is its transactionally-maintained current balance.
-- Services and combo products deliberately have no physical stock here.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_stock (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  average_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (average_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_product ON inventory_stock(product_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('STOCK_IN','STOCK_OUT','ADJUSTMENT_IN','ADJUSTMENT_OUT')),
  quantity NUMERIC(14,2) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(14,2) NULL CHECK (unit_cost >= 0),
  reference_type TEXT NOT NULL,
  reference_id UUID NULL,
  movement_date DATE NOT NULL,
  notes TEXT NULL,
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_source_once
  ON inventory_movements(product_id, movement_type, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_date ON inventory_movements(product_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);

-- PHASE 8: operational administration. Historical financial rows remain
-- immutable; periods/settings/taxes are separate configuration records.
CREATE TABLE IF NOT EXISTS fiscal_periods (
 id UUID PRIMARY KEY,name TEXT NOT NULL UNIQUE,start_date DATE NOT NULL,end_date DATE NOT NULL,status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED')),
 created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,closed_by_id UUID NULL REFERENCES users(id) ON DELETE RESTRICT,closed_at TIMESTAMPTZ NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CHECK(end_date>=start_date)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_dates ON fiscal_periods(start_date,end_date,status);
CREATE TABLE IF NOT EXISTS system_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS tax_configurations (id UUID PRIMARY KEY,name TEXT NOT NULL,rate NUMERIC(5,2) NOT NULL CHECK(rate>=0 AND rate<=100),tax_type TEXT NOT NULL DEFAULT 'GST',tax_account_id UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT,status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ARCHIVED')),created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),archived_at TIMESTAMPTZ NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_configurations_name_active ON tax_configurations(lower(name)) WHERE status='ACTIVE';
