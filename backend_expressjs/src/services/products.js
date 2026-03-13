/**
 * Product Service.
 * Handles CRUD operations for product management.
 *
 * Flow: ProductCRUDFlow
 * Entrypoint: getAll(), getById(), create(), update(), remove()
 * Contract:
 *   getAll - returns paginated product list with optional category/search filter
 *   getById - returns single product by UUID
 *   create - creates new product (admin only via controller)
 *   update - partial update of product fields
 *   remove - deletes a product
 * Errors: NotFoundError, ConflictError
 */
const db = require('../db/pool');
const logger = require('../config/logger');
const { NotFoundError, ConflictError } = require('../errors/AppError');

// PUBLIC_INTERFACE
/**
 * Get all products with pagination and optional filters.
 * @param {object} options - { page, limit, sort_by, sort_order, category, search }
 * @returns {Promise<{products: Array, total: number, page: number, limit: number}>}
 */
async function getAll({ page = 1, limit = 20, sort_by = 'created_at', sort_order = 'desc', category, search }) {
  logger.info('ProductCRUDFlow: getAll started', { page, limit, category, search });

  const allowedSortColumns = ['created_at', 'name', 'price', 'stock_quantity', 'category', 'sku'];
  const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
  const order = sort_order === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  // Build WHERE clauses dynamically
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (category) {
    conditions.push(`category = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }

  if (search) {
    conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM products ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const queryParams = [...params, limit, offset];
  const result = await db.query(
    `SELECT * FROM products ${whereClause} ORDER BY ${sortColumn} ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    queryParams
  );

  logger.info('ProductCRUDFlow: getAll completed', { total, returned: result.rows.length });
  return {
    products: result.rows,
    total,
    page,
    limit,
  };
}

// PUBLIC_INTERFACE
/**
 * Get a single product by ID.
 * @param {string} id - Product UUID
 * @returns {Promise<object>} Product object
 * @throws {NotFoundError} If product not found
 */
async function getById(id) {
  logger.info('ProductCRUDFlow: getById started', { productId: id });

  const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Product');
  }

  return result.rows[0];
}

// PUBLIC_INTERFACE
/**
 * Create a new product.
 * @param {object} data - Product data
 * @returns {Promise<object>} Created product
 * @throws {ConflictError} If SKU already exists
 */
async function create(data) {
  logger.info('ProductCRUDFlow: create started', { sku: data.sku, name: data.name });

  // Check for duplicate SKU
  const existing = await db.query('SELECT id FROM products WHERE sku = $1', [data.sku]);
  if (existing.rows.length > 0) {
    throw new ConflictError('A product with this SKU already exists');
  }

  const result = await db.query(
    `INSERT INTO products (name, description, price, stock_quantity, category, sku, image_url, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [data.name, data.description || null, data.price, data.stock_quantity || 0,
     data.category || null, data.sku, data.image_url || null, data.is_active !== false]
  );

  logger.info('ProductCRUDFlow: create completed', { productId: result.rows[0].id });
  return result.rows[0];
}

// PUBLIC_INTERFACE
/**
 * Update a product by ID.
 * @param {string} id - Product UUID
 * @param {object} data - Fields to update
 * @returns {Promise<object>} Updated product
 * @throws {NotFoundError} If product not found
 * @throws {ConflictError} If SKU conflicts
 */
async function update(id, data) {
  logger.info('ProductCRUDFlow: update started', { productId: id, fields: Object.keys(data) });

  const existing = await db.query('SELECT * FROM products WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Product');
  }

  // Check SKU uniqueness if being changed
  if (data.sku && data.sku !== existing.rows[0].sku) {
    const skuCheck = await db.query('SELECT id FROM products WHERE sku = $1 AND id != $2', [data.sku, id]);
    if (skuCheck.rows.length > 0) {
      throw new ConflictError('SKU is already in use');
    }
  }

  // Build dynamic update query
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const updatableFields = ['name', 'description', 'price', 'stock_quantity', 'category', 'sku', 'image_url', 'is_active'];
  for (const field of updatableFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${paramIndex}`);
      values.push(data[field]);
      paramIndex++;
    }
  }

  if (fields.length === 0) {
    return existing.rows[0];
  }

  values.push(id);
  const result = await db.query(
    `UPDATE products SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  logger.info('ProductCRUDFlow: update completed', { productId: id });
  return result.rows[0];
}

// PUBLIC_INTERFACE
/**
 * Delete a product by ID.
 * @param {string} id - Product UUID
 * @returns {Promise<void>}
 * @throws {NotFoundError} If product not found
 */
async function remove(id) {
  logger.info('ProductCRUDFlow: remove started', { productId: id });

  const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Product');
  }

  logger.info('ProductCRUDFlow: remove completed', { productId: id });
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};
