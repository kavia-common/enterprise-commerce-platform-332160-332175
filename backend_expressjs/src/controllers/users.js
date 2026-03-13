/**
 * Users Controller.
 * Handles HTTP request/response for user CRUD endpoints.
 * Delegates business logic to the users service.
 */
const usersService = require('../services/users');

// PUBLIC_INTERFACE
/**
 * Get all users with pagination.
 * GET /api/users
 * @param {import('express').Request} req - Request with validated query params
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getAll(req, res, next) {
  try {
    const result = await usersService.getAll(req.query);
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
 * Get a single user by ID.
 * GET /api/users/:id
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getById(req, res, next) {
  try {
    const user = await usersService.getById(req.params.id);
    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

// PUBLIC_INTERFACE
/**
 * Update a user by ID.
 * PUT /api/users/:id
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function update(req, res, next) {
  try {
    const user = await usersService.update(req.params.id, req.body);
    res.status(200).json({
      status: 'success',
      message: 'User updated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

// PUBLIC_INTERFACE
/**
 * Delete a user by ID.
 * DELETE /api/users/:id
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function remove(req, res, next) {
  try {
    await usersService.remove(req.params.id);
    res.status(200).json({
      status: 'success',
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAll,
  getById,
  update,
  remove,
};
