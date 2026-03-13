/**
 * Order Service.
 * Handles CRUD operations for order management with transactional support.
 *
 * Flow: OrderCRUDFlow
 * Entrypoint: getAll(), getById(), getByUserId(), create(), update(), remove()
 * Contract:
 *   create - transactionally creates order with items, validates stock, calculates totals
 *   getAll - admin: all orders; customer: own orders
 *   getByUserId - returns orders for a specific user
 * Errors: NotFoundError, ValidationError
 */
const db = require('../db/pool');
const logger = require('../config/logger');
const { NotFoundError, ValidationError } = require('../errors/AppError');

// PUBLIC_INTERFACE
/**
 * Get all orders with pagination (admin sees all, customer sees own).
 * @param {object} options - { page, limit, sort_by, sort_order, user_id, role }
 * @returns {Promise<{orders: Array, total: number, page: number, limit: number}>}
 */
async function getAll({ page = 1, limit = 20, sort_by = 'created_at', sort_order = 'desc', user_id, role }) {
  logger.info('OrderCRUDFlow: getAll started', { page, limit, user_id, role });

  const allowedSortColumns = ['created_at', 'status', 'total_amount'];
  const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
  const order = sort_order === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params = [];
  let paramIndex = 1;

  // Customers can only see their own orders
  if (role !== 'admin') {
    whereClause = `WHERE user_id = $${paramIndex}`;
    params.push(user_id);
    paramIndex++;
  }

  const countResult = await db.query(
    `SELECT COUNT(*) FROM orders ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const queryParams = [...params, limit, offset];
  const result = await db.query(
    `SELECT * FROM orders ${whereClause} ORDER BY ${sortColumn} ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    queryParams
  );

  logger.info('OrderCRUDFlow: getAll completed', { total, returned: result.rows.length });
  return {
    orders: result.rows,
    total,
    page,
    limit,
  };
}

// PUBLIC_INTERFACE
/**
 * Get a single order by ID with its items.
 * @param {string} id - Order UUID
 * @param {string} userId - Requesting user's ID (for ownership check)
 * @param {string} role - Requesting user's role
 * @returns {Promise<object>} Order with items
 * @throws {NotFoundError} If order not found or not authorized
 */
async function getById(id, userId, role) {
  logger.info('OrderCRUDFlow: getById started', { orderId: id });

  const orderResult = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
  if (orderResult.rows.length === 0) {
    throw new NotFoundError('Order');
  }

  const orderData = orderResult.rows[0];

  // Customers can only see their own orders
  if (role !== 'admin' && orderData.user_id !== userId) {
    throw new NotFoundError('Order');
  }

  // Get order items with product details
  const itemsResult = await db.query(
    `SELECT oi.*, p.name AS product_name, p.sku AS product_sku, p.image_url AS product_image_url
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1`,
    [id]
  );

  return {
    ...orderData,
    items: itemsResult.rows,
  };
}

// PUBLIC_INTERFACE
/**
 * Create a new order with items (transactional).
 * Validates product availability, calculates prices, deducts stock.
 * @param {string} userId - The ordering user's UUID
 * @param {object} data - { items: [{product_id, quantity}], shipping_address?, billing_address?, notes? }
 * @returns {Promise<object>} Created order with items
 * @throws {ValidationError} If products unavailable or insufficient stock
 */
async function create(userId, data) {
  logger.info('OrderCRUDFlow: create started', { userId, itemCount: data.items.length });

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Fetch and validate all products
    const productIds = data.items.map((item) => item.product_id);
    const productsResult = await client.query(
      'SELECT * FROM products WHERE id = ANY($1) AND is_active = true',
      [productIds]
    );

    const productMap = new Map();
    for (const product of productsResult.rows) {
      productMap.set(product.id, product);
    }

    // Validate all items
    let totalAmount = 0;
    const orderItems = [];

    for (const item of data.items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        throw new ValidationError(`Product ${item.product_id} not found or is inactive`);
      }
      if (product.stock_quantity < item.quantity) {
        throw new ValidationError(
          `Insufficient stock for "${product.name}". Available: ${product.stock_quantity}, Requested: ${item.quantity}`
        );
      }

      const itemTotal = parseFloat(product.price) * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.price,
        total_price: itemTotal.toFixed(2),
      });
    }

    // Create the order
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, status, total_amount, shipping_address, billing_address, notes)
       VALUES ($1, 'pending', $2, $3, $4, $5)
       RETURNING *`,
      [userId, totalAmount.toFixed(2), data.shipping_address || null, data.billing_address || null, data.notes || null]
    );

    const createdOrder = orderResult.rows[0];

    // Insert order items and update stock
    const insertedItems = [];
    for (const item of orderItems) {
      const itemResult = await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [createdOrder.id, item.product_id, item.quantity, item.unit_price, item.total_price]
      );
      insertedItems.push(itemResult.rows[0]);

      // Deduct stock
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    await client.query('COMMIT');

    logger.info('OrderCRUDFlow: create completed', { orderId: createdOrder.id, total: totalAmount });
    return {
      ...createdOrder,
      items: insertedItems,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('OrderCRUDFlow: create failed, transaction rolled back', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

// PUBLIC_INTERFACE
/**
 * Update an order (primarily status changes).
 * @param {string} id - Order UUID
 * @param {object} data - Fields to update (status, shipping_address, billing_address, notes)
 * @param {string} userId - Requesting user's ID
 * @param {string} role - Requesting user's role
 * @returns {Promise<object>} Updated order
 * @throws {NotFoundError} If order not found
 */
async function update(id, data, userId, role) {
  logger.info('OrderCRUDFlow: update started', { orderId: id, fields: Object.keys(data) });

  const existing = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Order');
  }

  // Customers can only update their own orders
  if (role !== 'admin' && existing.rows[0].user_id !== userId) {
    throw new NotFoundError('Order');
  }

  const fields = [];
  const values = [];
  let paramIndex = 1;

  const updatableFields = ['status', 'shipping_address', 'billing_address', 'notes'];
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
    `UPDATE orders SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  logger.info('OrderCRUDFlow: update completed', { orderId: id });
  return result.rows[0];
}

// PUBLIC_INTERFACE
/**
 * Delete an order by ID (admin only).
 * @param {string} id - Order UUID
 * @returns {Promise<void>}
 * @throws {NotFoundError} If order not found
 */
async function remove(id) {
  logger.info('OrderCRUDFlow: remove started', { orderId: id });

  const result = await db.query('DELETE FROM orders WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Order');
  }

  logger.info('OrderCRUDFlow: remove completed', { orderId: id });
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};
