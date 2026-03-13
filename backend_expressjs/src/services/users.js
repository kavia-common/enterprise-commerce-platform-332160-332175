/**
 * User Service.
 * Handles CRUD operations for user management.
 *
 * Flow: UserCRUDFlow
 * Entrypoint: getAll(), getById(), update(), remove()
 * Contract:
 *   getAll - returns paginated list of users (admin only)
 *   getById - returns single user by UUID
 *   update - partial update of user fields
 *   remove - soft-delete or hard-delete user
 * Errors: NotFoundError, ConflictError
 */
const db = require('../db/pool');
const logger = require('../config/logger');
const { NotFoundError, ConflictError } = require('../errors/AppError');

/**
 * Sanitize user object for API response (remove password_hash).
 * @param {object} user - Raw user row from database
 * @returns {object} User without sensitive fields
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

// PUBLIC_INTERFACE
/**
 * Get all users with pagination.
 * @param {object} options - { page, limit, sort_by, sort_order }
 * @returns {Promise<{users: Array, total: number, page: number, limit: number}>}
 */
async function getAll({ page = 1, limit = 20, sort_by = 'created_at', sort_order = 'desc' }) {
  logger.info('UserCRUDFlow: getAll started', { page, limit });

  // Whitelist sortable columns to prevent SQL injection
  const allowedSortColumns = ['created_at', 'email', 'first_name', 'last_name', 'role', 'is_active'];
  const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
  const order = sort_order === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  const countResult = await db.query('SELECT COUNT(*) FROM users');
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await db.query(
    `SELECT * FROM users ORDER BY ${sortColumn} ${order} LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  logger.info('UserCRUDFlow: getAll completed', { total, returned: result.rows.length });
  return {
    users: result.rows.map(sanitizeUser),
    total,
    page,
    limit,
  };
}

// PUBLIC_INTERFACE
/**
 * Get a single user by ID.
 * @param {string} id - User UUID
 * @returns {Promise<object>} User object
 * @throws {NotFoundError} If user not found
 */
async function getById(id) {
  logger.info('UserCRUDFlow: getById started', { userId: id });

  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('User');
  }

  return sanitizeUser(result.rows[0]);
}

// PUBLIC_INTERFACE
/**
 * Update a user by ID.
 * @param {string} id - User UUID
 * @param {object} data - Fields to update
 * @returns {Promise<object>} Updated user object
 * @throws {NotFoundError} If user not found
 * @throws {ConflictError} If email already taken
 */
async function update(id, data) {
  logger.info('UserCRUDFlow: update started', { userId: id, fields: Object.keys(data) });

  // Check user exists
  const existing = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('User');
  }

  // If email is being changed, check for conflicts
  if (data.email && data.email !== existing.rows[0].email) {
    const emailCheck = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [data.email, id]);
    if (emailCheck.rows.length > 0) {
      throw new ConflictError('Email is already in use');
    }
  }

  // Build dynamic update query
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const updatableFields = ['email', 'first_name', 'last_name', 'role', 'is_active'];
  for (const field of updatableFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${paramIndex}`);
      values.push(data[field]);
      paramIndex++;
    }
  }

  if (fields.length === 0) {
    return sanitizeUser(existing.rows[0]);
  }

  values.push(id);
  const result = await db.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  logger.info('UserCRUDFlow: update completed', { userId: id });
  return sanitizeUser(result.rows[0]);
}

// PUBLIC_INTERFACE
/**
 * Delete a user by ID.
 * @param {string} id - User UUID
 * @returns {Promise<void>}
 * @throws {NotFoundError} If user not found
 */
async function remove(id) {
  logger.info('UserCRUDFlow: remove started', { userId: id });

  const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('User');
  }

  logger.info('UserCRUDFlow: remove completed', { userId: id });
}

module.exports = {
  getAll,
  getById,
  update,
  remove,
  sanitizeUser,
};
