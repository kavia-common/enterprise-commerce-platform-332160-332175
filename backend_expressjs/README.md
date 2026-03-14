# backend_expressjs

Express.js REST API with:
- JWT authentication (template login/logout)
- Role-based access control (admin/user)
- **User Activity Log** persisted to PostgreSQL (`user_activity_logs`)

## Environment
Uses `.env` (already present). Key variables:
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ALLOWED_ORIGINS`

## Database schema (required)
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
  action text NOT NULL,              -- e.g. login, logout, update_profile

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

## Endpoints
- `POST /api/auth/login` -> returns `{ token, user }` and logs LOGIN
- `POST /api/auth/logout` -> logs LOGOUT
- `PATCH /api/users/me` (Bearer token) -> logs DATA_UPDATE
- `GET /api/admin/activity` (admin only) -> list logs

### Admin role
In this template, any email ending with `@admin.test` is treated as `admin`.
