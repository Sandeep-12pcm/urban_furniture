# Urban Furniture - Accounting Auth Foundation

Stack used:

- Frontend: React.js, Tailwind CSS, Recharts
- Backend: Node.js, Express.js
- Database: PostgreSQL
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

The seed creates the first Admin from environment variables, hashes the password, and is safe to run repeatedly.

## Run

```bash
npm run dev:api
npm run dev:web
```

- API: `http://localhost:4000/api`
- Swagger: `http://localhost:4000/api/docs`
- React app: `http://localhost:5173/login`

## Endpoints

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/signup`, creates pending `ACCOUNTANT` requests or active Customer/Vendor contact accounts
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/users`, scoped account list: Admin sees all, Accountant sees self plus users, Customer/Vendor sees self
- `POST /api/users/:id/approve-accountant`, Admin only, approves pending accountant logins
- `POST /api/users`, Admin only fallback endpoint for manually creating `ACCOUNTANT` or `CONTACT`
- `GET /api/admin/health`, Admin only
- `GET /api/contact/portal`, Contact only

## Database Tables

- `users`: login ID, email, password hash, role, customer/vendor account type, approval status, active status, future `contact_id`, timestamps.
- `password_reset_tokens`: hashed expiring reset tokens.
- `audit_logs`: audit foundation for login, logout, user creation, password reset events.

Passwords are never stored in plaintext and `password_hash` is never returned by API responses.
