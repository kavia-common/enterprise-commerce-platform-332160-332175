/**
 * PostgreSQL Connection Pool.
 * Reusable database access layer using pg Pool.
 * Connection info sourced from config (which reads DATABASE_URL env var,
 * aligned with database_postgresql/db_connection.txt).
 *
 * Contract:
 * - Exports a singleton Pool instance
 * - All database modules use this pool for queries
 * - Pool handles connection lifecycle automatically
 */
const { Pool } = require('pg');
const config = require('../config');
const logger = require('../config/logger');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  logger.debug('Database pool: new client connected');
});

pool.on('error', (err) => {
  logger.error('Database pool: unexpected error on idle client', { error: err.message });
});

// PUBLIC_INTERFACE
/**
 * Execute a parameterized SQL query against the PostgreSQL database.
 * @param {string} text - SQL query string with $1, $2, ... placeholders
 * @param {Array} params - Array of parameter values
 * @returns {Promise<import('pg').QueryResult>} Query result
 * @throws {Error} Database query errors are propagated with context
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('DB query executed', { text: text.substring(0, 80), duration: `${duration}ms`, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('DB query failed', { text: text.substring(0, 80), error: error.message });
    throw error;
  }
}

// PUBLIC_INTERFACE
/**
 * Get a client from the pool for transaction use.
 * Caller MUST release the client when done.
 * @returns {Promise<import('pg').PoolClient>} A database client
 */
async function getClient() {
  return pool.connect();
}

// PUBLIC_INTERFACE
/**
 * Test the database connection.
 * @returns {Promise<boolean>} True if connected successfully
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW() AS now');
    logger.info('Database connection test successful', { serverTime: result.rows[0].now });
    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error: error.message });
    return false;
  }
}

module.exports = {
  pool,
  query,
  getClient: () => pool.connect(),
  testConnection,
};
