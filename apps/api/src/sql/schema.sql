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

ALTER TABLE users
  ALTER COLUMN contact_id TYPE TEXT USING contact_id::TEXT;

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
