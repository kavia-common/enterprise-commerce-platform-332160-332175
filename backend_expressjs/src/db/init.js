'use strict';

const { getPool } = require('./pool');
const { logger } = require('../shared/logger');

/**
 * SQL statements to create the required tables for products and orders.
 * Uses IF NOT EXISTS to be safely idempotent on every server start.
 */
const CREATE_PRODUCTS_TABLE = `
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
`;

const CREATE_ORDERS_TABLE = `
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
`;

const CREATE_ORDERS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
`;

const CREATE_ORDERS_STATUS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`;

// PUBLIC_INTERFACE
/**
 * Initialize the database schema.
 *
 * Contract:
 * - Inputs: none
 * - Output: void (resolves on success)
 * - Errors: Logs errors but does NOT throw — the server should still start even if DB init fails
 *   (e.g., the activity_logs table was already created by another migration).
 * - Side effects: Creates products and orders tables if they do not exist.
 */
async function initDatabase() {
  const pool = getPool();

  logger.info({ op: 'db.init.start' }, 'Initializing database tables');

  try {
    // Ensure pgcrypto is available for gen_random_uuid()
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await pool.query(CREATE_PRODUCTS_TABLE);
    await pool.query(CREATE_ORDERS_TABLE);
    await pool.query(CREATE_ORDERS_INDEX);
    await pool.query(CREATE_ORDERS_STATUS_INDEX);

    logger.info({ op: 'db.init.success' }, 'Database tables initialized successfully');
  } catch (err) {
    logger.error(
      { op: 'db.init.failure', errMessage: err?.message },
      'Failed to initialize database tables — server will continue but some features may not work'
    );
  }
}

module.exports = { initDatabase };
