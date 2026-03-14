'use strict';

const express = require('express');
const { z } = require('zod');

const { requireAuth, requireAdmin } = require('../middlewares/auth');
const { AppError } = require('../shared/errors');
const { getPool } = require('../db/pool');
const { logCrudActivity, CrudAction } = require('../shared/activityHelper');

const productsRouter = express.Router();

/* ───────── Validation Schemas ───────── */

const CreateProductSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(2048).nullable().optional(),
  price: z.number().min(0),
  stock: z.number().int().min(0).optional(),
  category: z.string().max(128).nullable().optional(),
  isActive: z.boolean().optional()
});

const UpdateProductSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  description: z.string().max(2048).nullable().optional(),
  price: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  category: z.string().max(128).nullable().optional(),
  isActive: z.boolean().optional()
});

const UuidParamSchema = z.object({
  id: z.string().uuid()
});

/* ───────── Routes ───────── */

/**
 * GET /api/products
 * List all products. Public endpoint (no auth required).
 * Query params: category, isActive, limit, offset
 */
// PUBLIC_INTERFACE
productsRouter.get('/', async (req, res, next) => {
  /**
   * Retrieve a paginated list of products with optional filters.
   * @query {string} [category] - Filter by category
   * @query {string} [isActive] - Filter by active status ("true"/"false")
   * @query {number} [limit=50] - Max items to return (1-200)
   * @query {number} [offset=0] - Pagination offset
   * @returns {{ items: Product[], total: number }}
   */
  try {
    const pool = getPool();
    const where = [];
    const values = [];
    let idx = 1;

    if (req.query.category) {
      where.push(`category = $${idx++}`);
      values.push(req.query.category);
    }
    if (req.query.isActive !== undefined) {
      where.push(`is_active = $${idx++}`);
      values.push(req.query.isActive === 'true');
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM products ${whereSql}`,
      values
    );
    const total = totalRes.rows[0]?.count ?? 0;

    const itemsRes = await pool.query(
      `SELECT id, created_at, updated_at, name, description, price, stock, category, is_active
       FROM products ${whereSql}
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
 * GET /api/products/:id
 * Get a single product by ID. Public endpoint.
 */
// PUBLIC_INTERFACE
productsRouter.get('/:id', async (req, res, next) => {
  /**
   * Retrieve a single product by its UUID.
   * @param {string} id - Product UUID
   * @returns {Product}
   */
  try {
    const paramsParsed = UuidParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      throw new AppError('Invalid product ID', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    const pool = getPool();
    const result = await pool.query(
      `SELECT id, created_at, updated_at, name, description, price, stock, category, is_active
       FROM products WHERE id = $1`,
      [paramsParsed.data.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Product not found', { statusCode: 404, code: 'NOT_FOUND' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/products
 * Create a new product. Requires admin role.
 * Body: { name, description?, price, stock?, category?, isActive? }
 */
// PUBLIC_INTERFACE
productsRouter.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  /**
   * Create a new product. Admin only.
   * @body {CreateProductInput} - Product data
   * @returns {{ id: string, ...Product }}
   */
  try {
    const parsed = CreateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid product payload', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten()
      });
    }

    const { name, description, price, stock, category, isActive } = parsed.data;
    const pool = getPool();

    const result = await pool.query(
      `INSERT INTO products (name, description, price, stock, category, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at, updated_at, name, description, price, stock, category, is_active`,
      [
        name,
        description ?? null,
        price,
        stock ?? 0,
        category ?? null,
        isActive ?? true
      ]
    );

    const product = result.rows[0];

    // Log activity: product created
    await logCrudActivity(req, 'PRODUCT', product.id, CrudAction.CREATE, {
      productName: name,
      price,
      category: category ?? null
    });

    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/products/:id
 * Update an existing product. Requires admin role.
 * Body: { name?, description?, price?, stock?, category?, isActive? }
 */
// PUBLIC_INTERFACE
productsRouter.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  /**
   * Update an existing product by ID. Admin only.
   * @param {string} id - Product UUID
   * @body {UpdateProductInput} - Partial product data
   * @returns {Product}
   */
  try {
    const paramsParsed = UuidParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      throw new AppError('Invalid product ID', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    const parsed = UpdateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid update payload', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten()
      });
    }

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) {
      throw new AppError('No fields to update', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    // Build dynamic SET clause
    const setClauses = [];
    const values = [];
    let idx = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${idx++}`);
      values.push(updates.description);
    }
    if (updates.price !== undefined) {
      setClauses.push(`price = $${idx++}`);
      values.push(updates.price);
    }
    if (updates.stock !== undefined) {
      setClauses.push(`stock = $${idx++}`);
      values.push(updates.stock);
    }
    if (updates.category !== undefined) {
      setClauses.push(`category = $${idx++}`);
      values.push(updates.category);
    }
    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${idx++}`);
      values.push(updates.isActive);
    }

    setClauses.push(`updated_at = now()`);

    const productId = paramsParsed.data.id;
    values.push(productId);

    const pool = getPool();
    const result = await pool.query(
      `UPDATE products SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, created_at, updated_at, name, description, price, stock, category, is_active`,
      values
    );

    if (result.rows.length === 0) {
      throw new AppError('Product not found', { statusCode: 404, code: 'NOT_FOUND' });
    }

    const product = result.rows[0];

    // Log activity: product updated
    await logCrudActivity(req, 'PRODUCT', productId, CrudAction.UPDATE, {
      updatedFields: Object.keys(updates)
    });

    res.json(product);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/products/:id
 * Delete a product. Requires admin role.
 */
// PUBLIC_INTERFACE
productsRouter.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  /**
   * Delete a product by ID. Admin only.
   * @param {string} id - Product UUID
   * @returns {{ ok: true, id: string }}
   */
  try {
    const paramsParsed = UuidParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      throw new AppError('Invalid product ID', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    const productId = paramsParsed.data.id;
    const pool = getPool();

    // Fetch product name before deletion for metadata
    const existing = await pool.query('SELECT name FROM products WHERE id = $1', [productId]);
    if (existing.rows.length === 0) {
      throw new AppError('Product not found', { statusCode: 404, code: 'NOT_FOUND' });
    }

    await pool.query('DELETE FROM products WHERE id = $1', [productId]);

    // Log activity: product deleted
    await logCrudActivity(req, 'PRODUCT', productId, CrudAction.DELETE, {
      deletedProductName: existing.rows[0].name
    });

    res.json({ ok: true, id: productId });
  } catch (err) {
    next(err);
  }
});

module.exports = { productsRouter };
