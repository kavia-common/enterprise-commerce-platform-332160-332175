/**
 * Products Controller.
 * Handles HTTP request/response for product CRUD endpoints.
 * Delegates business logic to the products service.
 */
const productsService = require('../services/products');

// PUBLIC_INTERFACE
/**
 * Get all products with pagination and optional filters.
 * GET /api/products
 * @param {import('express').Request} req - Query: page, limit, sort_by, sort_order, category, search
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getAll(req, res, next) {
  try {
    const result = await productsService.getAll(req.query);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// PUBLIC_INTERFACE
/**
 * Get a single product by ID.
 * GET /api/products/:id
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getById(req, res, next) {
  try {
    const product = await productsService.getById(req.params.id);
    res.status(200).json({
      status: 'success',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
}

// PUBLIC_INTERFACE
/**
 * Create a new product (admin only).
 * POST /api/products
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function create(req, res, next) {
  try {
    const product = await productsService.create(req.body);
    res.status(201).json({
      status: 'success',
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
}

// PUBLIC_INTERFACE
/**
 * Update a product by ID (admin only).
 * PUT /api/products/:id
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function update(req, res, next) {
  try {
    const product = await productsService.update(req.params.id, req.body);
    res.status(200).json({
      status: 'success',
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
}

// PUBLIC_INTERFACE
/**
 * Delete a product by ID (admin only).
 * DELETE /api/products/:id
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function remove(req, res, next) {
  try {
    await productsService.remove(req.params.id);
    res.status(200).json({
      status: 'success',
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};
