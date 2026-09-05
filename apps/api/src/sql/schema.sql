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
