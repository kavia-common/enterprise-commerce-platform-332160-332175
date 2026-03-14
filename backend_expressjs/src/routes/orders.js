'use strict';

const express = require('express');
const { z } = require('zod');

const { requireAuth, requireAdmin } = require('../middlewares/auth');
const { AppError } = require('../shared/errors');
const { getPool } = require('../db/pool');
const { logCrudActivity, CrudAction } = require('../shared/activityHelper');

const ordersRouter = express.Router();

/* ───────── Validation Schemas ───────── */

const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().min(1).max(256),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0)
});

const ShippingAddressSchema = z.object({
  street: z.string().min(1).max(512),
  city: z.string().min(1).max(128),
  state: z.string().max(128).optional(),
  zipCode: z.string().max(32).optional(),
  country: z.string().min(1).max(128)
});

const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1),
  shippingAddress: ShippingAddressSchema.nullable().optional(),
  notes: z.string().max(1024).nullable().optional()
});

const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
  notes: z.string().max(1024).nullable().optional()
});

const UuidParamSchema = z.object({
  id: z.string().uuid()
});

/* ───────── Routes ───────── */

/**
 * GET /api/orders
 * List orders. Admins see all orders; regular users see only their own.
 * Query params: status, limit, offset
 */
// PUBLIC_INTERFACE
ordersRouter.get('/', requireAuth, async (req, res, next) => {
  /**
   * Retrieve a paginated list of orders.
   * Admin: all orders. User: own orders only.
   * @query {string} [status] - Filter by order status
   * @query {number} [limit=50] - Max items to return (1-200)
   * @query {number} [offset=0] - Pagination offset
   * @returns {{ items: Order[], total: number }}
   */
  try {
    const pool = getPool();
    const where = [];
    const values = [];
    let idx = 1;

    // Non-admin users can only see their own orders
    if (req.user.role !== 'admin') {
      where.push(`user_id = $${idx++}`);
      values.push(req.user.id);
    }

    if (req.query.status) {
      where.push(`status = $${idx++}`);
      values.push(req.query.status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM orders ${whereSql}`,
      values
    );
    const total = totalRes.rows[0]?.count ?? 0;

    const itemsRes = await pool.query(
      `SELECT id, created_at, updated_at, user_id, user_email, status, total, items, shipping_address, notes
       FROM orders ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    res.json({ items: itemsRes.rows, total });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/:id
 * Get a single order by ID. Admins can view any order; users can only view their own.
 */
// PUBLIC_INTERFACE
ordersRouter.get('/:id', requireAuth, async (req, res, next) => {
  /**
   * Retrieve a single order by its UUID.
   * Admin: any order. User: own order only.
   * @param {string} id - Order UUID
   * @returns {Order}
   */
  try {
    const paramsParsed = UuidParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      throw new AppError('Invalid order ID', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    const pool = getPool();
    const result = await pool.query(
      `SELECT id, created_at, updated_at, user_id, user_email, status, total, items, shipping_address, notes
       FROM orders WHERE id = $1`,
      [paramsParsed.data.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Order not found', { statusCode: 404, code: 'NOT_FOUND' });
    }

    const order = result.rows[0];

    // Non-admin users can only view their own orders
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      throw new AppError('Forbidden', { statusCode: 403, code: 'FORBIDDEN' });
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/orders
 * Create a new order. Requires authentication.
 * Body: { items: [...], shippingAddress?, notes? }
 */
// PUBLIC_INTERFACE
ordersRouter.post('/', requireAuth, async (req, res, next) => {
  /**
   * Create a new order for the authenticated user.
   * @body {CreateOrderInput} - Order data with items
   * @returns {Order} - The created order
   */
  try {
    const parsed = CreateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid order payload', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten()
      });
    }

    const { items, shippingAddress, notes } = parsed.data;

    // Calculate total from items
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO orders (user_id, user_email, status, total, items, shipping_address, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at, updated_at, user_id, user_email, status, total, items, shipping_address, notes`,
      [
        req.user.id,
        req.user.email,
        'pending',
        total,
        JSON.stringify(items),
        shippingAddress ? JSON.stringify(shippingAddress) : null,
        notes ?? null
      ]
    );

    const order = result.rows[0];

    // Log activity: order created
    await logCrudActivity(req, 'ORDER', order.id, CrudAction.CREATE, {
      itemCount: items.length,
      total,
      status: 'pending'
    });

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/orders/:id
 * Update order status. Admin can update any order; users can only cancel their own pending orders.
 * Body: { status, notes? }
 */
// PUBLIC_INTERFACE
ordersRouter.patch('/:id', requireAuth, async (req, res, next) => {
  /**
   * Update an order's status. Admin: any transition. User: can only cancel own pending orders.
   * @param {string} id - Order UUID
   * @body {UpdateOrderStatusInput} - New status and optional notes
   * @returns {Order}
   */
  try {
    const paramsParsed = UuidParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      throw new AppError('Invalid order ID', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    const parsed = UpdateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid update payload', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten()
      });
    }

    const orderId = paramsParsed.data.id;
    const { status, notes } = parsed.data;
    const pool = getPool();

    // Fetch existing order
    const existing = await pool.query(
      'SELECT id, user_id, status FROM orders WHERE id = $1',
      [orderId]
    );
    if (existing.rows.length === 0) {
      throw new AppError('Order not found', { statusCode: 404, code: 'NOT_FOUND' });
    }

    const currentOrder = existing.rows[0];

    // Non-admin users can only cancel their own pending orders
    if (req.user.role !== 'admin') {
      if (currentOrder.user_id !== req.user.id) {
        throw new AppError('Forbidden', { statusCode: 403, code: 'FORBIDDEN' });
      }
      if (status !== 'cancelled' || currentOrder.status !== 'pending') {
        throw new AppError('Users can only cancel pending orders', {
          statusCode: 403,
          code: 'FORBIDDEN'
        });
      }
    }

    const setClauses = [`status = $1`, `updated_at = now()`];
    const values = [status];
    let idx = 2;

    if (notes !== undefined) {
      setClauses.push(`notes = $${idx++}`);
      values.push(notes);
    }

    values.push(orderId);

    const result = await pool.query(
      `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, created_at, updated_at, user_id, user_email, status, total, items, shipping_address, notes`,
      values
    );

    const order = result.rows[0];

    // Log activity: order status updated
    await logCrudActivity(req, 'ORDER', orderId, CrudAction.UPDATE, {
      previousStatus: currentOrder.status,
      newStatus: status
    });

    res.json(order);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/orders/:id
 * Delete an order. Admin only.
 */
// PUBLIC_INTERFACE
ordersRouter.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  /**
   * Delete an order by ID. Admin only.
   * @param {string} id - Order UUID
   * @returns {{ ok: true, id: string }}
   */
  try {
    const paramsParsed = UuidParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      throw new AppError('Invalid order ID', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    const orderId = paramsParsed.data.id;
    const pool = getPool();

    // Fetch order metadata before deletion
    const existing = await pool.query(
      'SELECT id, user_email, status, total FROM orders WHERE id = $1',
      [orderId]
    );
    if (existing.rows.length === 0) {
      throw new AppError('Order not found', { statusCode: 404, code: 'NOT_FOUND' });
    }

    await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);

    // Log activity: order deleted
    const deletedOrder = existing.rows[0];
    await logCrudActivity(req, 'ORDER', orderId, CrudAction.DELETE, {
      deletedOrderStatus: deletedOrder.status,
      deletedOrderTotal: deletedOrder.total,
      deletedOrderUserEmail: deletedOrder.user_email
    });

    res.json({ ok: true, id: orderId });
  } catch (err) {
    next(err);
  }
});

module.exports = { ordersRouter };
