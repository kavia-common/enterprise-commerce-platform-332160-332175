'use strict';

const { Pool } = require('pg');
const { logger } = require('../shared/logger');

let pool;

/**
 * Get a singleton pg Pool.
 * Using a singleton avoids creating too many connections in dev/CI.
 */
function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  pool = new Pool({ connectionString });
  pool.on('error', (err) => {
    logger.error({ op: 'db.pool.error', errMessage: err?.message }, 'Unexpected pg pool error');
  });
  return pool;
}

module.exports = { getPool };
