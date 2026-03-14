# backend_expressjs

Express.js REST API with:
- JWT authentication (template login/logout)
- Role-based access control (admin/user)
- **User Activity Log** persisted to PostgreSQL (`user_activity_logs`)
- **Product CRUD** with activity logging on create/update/delete
- **Order CRUD** with activity logging on create/update/delete

## Environment
Uses `.env` (already present). Key variables:
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ALLOWED_ORIGINS`

## Database schema (required)
The server automatically creates `products` and `orders` tables on startup via `db/init.js`.

Create the `user_activity_logs` table in Postgres:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  actor_user_id uuid NULL,
  actor_email text NULL,

  event_type text NOT NULL,          -- LOGIN | LOGOUT | DATA_UPDATE
  resource_type text NOT NULL,       -- AUTH | USER | PRODUCT | ORDER | ...
  resource_id text NULL,
  action text NOT NULL,              -- e.g. login, logout, update_profile, create, update, delete

  metadata jsonb NULL,

  ip_address text NULL,
  user_agent text NULL,
  request_id text NULL
);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_event_type ON user_activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_resource_type ON user_activity_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_actor_user_id ON user_activity_logs(actor_user_id);
```

Auto-created tables for products and orders:

```sql
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  description text NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  category text NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NULL,
  user_email text NULL,
  status text NOT NULL DEFAULT 'pending',
  total numeric(12,2) NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  shipping_address jsonb NULL,
  notes text NULL
);
```

## Endpoints

### Auth
- `POST /api/auth/login` → returns `{ token, user }` and logs LOGIN
- `POST /api/auth/logout` → logs LOGOUT

### Users
- `PATCH /api/users/me` (Bearer token) → logs DATA_UPDATE

### Products
- `GET /api/products` → list products (public, no auth required)
- `GET /api/products/:id` → get single product (public)
- `POST /api/products` (admin only) → create product, logs DATA_UPDATE (action: create)
- `PATCH /api/products/:id` (admin only) → update product, logs DATA_UPDATE (action: update)
- `DELETE /api/products/:id` (admin only) → delete product, logs DATA_UPDATE (action: delete)

### Orders
- `GET /api/orders` (auth required) → list orders (admin: all, user: own only)
- `GET /api/orders/:id` (auth required) → get single order (admin: any, user: own only)
- `POST /api/orders` (auth required) → create order, logs DATA_UPDATE (action: create)
- `PATCH /api/orders/:id` (auth required) → update order status, logs DATA_UPDATE (action: update)
  - Admin: any status transition
  - User: can only cancel own pending orders
- `DELETE /api/orders/:id` (admin only) → delete order, logs DATA_UPDATE (action: delete)

### Admin Activity Logs
- `GET /api/admin/activity` (admin only) → list activity logs with filters

### Activity Logging
All CRUD mutations (create, update, delete) on products and orders are automatically logged via the `ActivityLogFlow` with:
- **actor**: extracted from JWT (user ID and email)
- **entity**: resource type (PRODUCT/ORDER) and resource ID
- **metadata**: contextual info (e.g., updated fields, previous status, product name)
- **request context**: IP address, user-agent, request ID

### Admin role
In this template, any email ending with `@admin.test` is treated as `admin`.
