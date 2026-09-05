# Urban Furniture - Accounting System

**Phase 0** shipped the authentication foundation. **Phase 1** adds the
complete Master Data foundation (Contacts, Product Categories, Products,
Chart of Accounts, Journals, Analytic Accounts, Budgets) that later
Sales/Purchase/Invoice/Payment/Journal Entry phases will build on.

Stack used:

- Frontend: React.js (React Router), Tailwind CSS, Recharts
- Backend: Node.js, Express.js
- Database: PostgreSQL (`pg`, hand-written SQL migrations — no ORM)
- API: REST API
- Auth: JWT with HTTP-only cookie support
- Authorization: RBAC
- API docs: Swagger/OpenAPI
- PDF dependency: PDFKit, ready for later modules

## Environment

Copy the example files:

```bash
cp .env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Default database URL:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/urban_furniture?schema=public"
```

The Express backend strips `?schema=public` before connecting because that query param is not used by the plain PostgreSQL `pg` client.

Set these values in `apps/api/.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/urban_furniture?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="1d"
FRONTEND_URL="http://localhost:5173"
PORT="4000"
NODE_ENV="development"
ENABLE_PUBLIC_SIGNUP="true"
ADMIN_LOGIN_ID="admin"
ADMIN_EMAIL="admin@urbanfurniture.local"
ADMIN_PASSWORD="ChangeMe@12345"
```

Set this in `apps/web/.env`:

```bash
VITE_API_URL="http://127.0.0.1:4000/api"
VITE_ENABLE_SIGNUP="true"
```

## Install

```bash
npm install
```

## Database

Create the database first:

```bash
createdb urban_furniture
```

Then run:

```bash
npm run db:migrate
npm run db:seed
```

`npm run db:seed` runs both `db:seed:admin` (first Admin from environment
variables) and `db:seed:master-data` (sample Chart of Accounts, Journals,
and Product Categories — see Seed Data below). Both are safe to run
repeatedly.

## Run

```bash
npm run dev:api
npm run dev:web
```

- API: `http://localhost:4000/api`
- Swagger: `http://localhost:4000/api/docs`
- React app: `http://localhost:5173/login`

## Endpoints

Authentication (Phase 0):

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/signup`, creates pending `ACCOUNTANT` requests or active Customer/Vendor contact accounts
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/users`, scoped account list: Admin sees all, Accountant sees self plus users, Customer/Vendor sees self
- `POST /api/users/:id/approve-accountant`, Admin only, approves pending accountant logins
- `POST /api/users`, Admin only fallback endpoint for manually creating `ACCOUNTANT` or `CONTACT`
- `GET /api/users/assignable`, Admin/Accountant only, active Admin/Accountant users for pickers (e.g. Budget responsible person)
- `GET /api/admin/health`, Admin only
- `GET /api/contact/portal`, Contact only

Master Data (Phase 1) — every resource below follows the same REST shape:
`GET /api/<resource>`, `GET /api/<resource>/:id`, `POST /api/<resource>`,
`PATCH /api/<resource>/:id`, `POST /api/<resource>/:id/archive`,
`POST /api/<resource>/:id/restore`. Create/Update/View require ADMIN or
ACCOUNTANT; Archive/Restore require ADMIN. CONTACT and unauthenticated
requests are always rejected (403 / 401). Full request/response/validation
docs are in Swagger at `/api/docs`.

- `/api/contacts` — Customer/Vendor/Both. `POST` also accepts
  `{ createPortalAccount: true, portalAccount: {...} }` to create a linked
  CONTACT-role user in the same transaction (never ADMIN).
- `/api/product-categories`
- `/api/products` — Goods/Service/Combo, linked to an active category.
- `/api/accounts` — Chart of Accounts, ASSET/LIABILITY/EXPENSE/INCOME/CAPITAL, supports parent/child.
- `/api/journals` — SALES/PURCHASE/BANK/CASH, each with a default account.
- `/api/analytic-accounts` — INCOME/EXPENSE.
- `/api/budgets` — period, planned amount, analytic account, responsible person.

## Database Tables

Phase 0 (authentication):

- `users`: login ID, email, password hash, role, customer/vendor account type, approval status, active status, `contact_id` (FK to `contacts`), timestamps.
- `password_reset_tokens`: hashed expiring reset tokens.
- `audit_logs`: audit foundation for login, logout, user creation, password reset, and every Master Data create/update/archive/restore event.

Phase 1 (Master Data — see `apps/api/src/sql/schema.sql` for full DDL):

- `contacts`: name, type (CUSTOMER/VENDOR/BOTH), email, mobile, address, profile image, status/archivedAt, optional linked `users` row.
- `product_categories`: name (unique), description, status.
- `products`: name, type (GOODS/SERVICE/COMBO), `sales_price`/`purchase_price` (NUMERIC(14,2)), FK to an active category.
- `accounts`: `account_code` (unique), `account_name`, type (ASSET/LIABILITY/EXPENSE/INCOME/CAPITAL), self-referencing `parent_account_id`.
- `journals`: name (unique), type (SALES/PURCHASE/BANK/CASH), `default_account_id` FK to `accounts`.
- `analytic_accounts`: name (unique), type (INCOME/EXPENSE).
- `budgets`: name, `period_start`/`period_end` (DATE, end ≥ start enforced by CHECK), `planned_amount` (NUMERIC(14,2)), FK to `analytic_accounts` and to `users` (responsible person).

All Master Data tables use `status` (`ACTIVE`/`ARCHIVED`) + `archived_at`
instead of hard deletes, so historical references survive once later
phases add transactions against them. Money columns are PostgreSQL
`NUMERIC(14,2)`, never floating point.

Passwords are never stored in plaintext and `password_hash` is never returned by API responses.

## Seed Data

`npm run db:seed:master-data` inserts development/sample rows (idempotent,
safe to re-run):

- Product categories: Chairs, Tables, Sofas, Office Furniture
- Chart of Accounts: 1001 Cash, 1002 Bank, 1003 Debtors, 2001 Creditors, 3001 Owner Capital, 4001 Sales Income, 5001 Purchase Expense
- Journals: Sales Journal → 4001, Purchase Journal → 5001, Bank Journal → 1002, Cash Journal → 1001

## Tests

```bash
npm test
```

Runs against a real, disposable PostgreSQL database (`urban_furniture_test`
by default — override with `TEST_DATABASE_ADMIN_URL` / `TEST_DATABASE_NAME`),
created and migrated automatically by `apps/api/test/globalSetup.js`. 54
tests cover auth/RBAC (pre-existing) plus create/update/archive/restore,
validation, duplicate/invalid data, and authorization for every Phase 1
resource.
