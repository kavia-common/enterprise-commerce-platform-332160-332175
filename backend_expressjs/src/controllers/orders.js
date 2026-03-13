/**
 * Orders Controller.
 * Handles HTTP request/response for order CRUD endpoints.
 * Delegates business logic to the orders service.
 */
const ordersService = require('../services/orders');

// PUBLIC_INTERFACE
/**
 * Get all orders with pagination.
 * GET /api/orders
 * Admin sees all orders; customers see only their own.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getAll(req, res, next) {
  try {
    const result = await ordersService.getAll({
      ...req.query,
      user_id: req.user.id,
      role: req.user.role,
    });
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
 * Get a single order by ID with items.
 * GET /api/orders/:id
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getById(req, res, next) {
  try {
    const order = await ordersService.getById(req.params.id, req.user.id, req.user.role);
    res.status(200).json({
      status: 'success',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
}

// PUBLIC_INTERFACE
/**
 * Create a new order.
 * POST /api/orders
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function create(req, res, next) {
  try {
    const order = await ordersService.create(req.user.id, req.body);
    res.status(201).json({
      status: 'success',
      message: 'Order created successfully',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
}

// PUBLIC_INTERFACE
/**
 * Update an order by ID.
 * PUT /api/orders/:id
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function update(req, res, next) {
  try {
    const order = await ordersService.update(req.params.id, req.body, req.user.id, req.user.role);
    res.status(200).json({
      status: 'success',
      message: 'Order updated successfully',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
}

// PUBLIC_INTERFACE
/**
 * Delete an order by ID (admin only).
 * DELETE /api/orders/:id
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function remove(req, res, next) {
  try {
    await ordersService.remove(req.params.id);
    res.status(200).json({
      status: 'success',
      message: 'Order deleted successfully',
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
