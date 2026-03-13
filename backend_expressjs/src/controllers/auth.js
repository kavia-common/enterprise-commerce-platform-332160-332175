/**
 * Auth Controller.
 * Handles HTTP request/response for authentication endpoints.
 * Delegates business logic to the auth service.
 */
const authService = require('../services/auth');
const logger = require('../config/logger');

// PUBLIC_INTERFACE
/**
 * Handle user signup.
 * POST /api/auth/signup
 * @param {import('express').Request} req - Request with validated body { email, password, first_name, last_name, role? }
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function signup(req, res, next) {
  try {
    const result = await authService.signup(req.body);
    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// PUBLIC_INTERFACE
/**
 * Handle user login.
 * POST /api/auth/login
 * @param {import('express').Request} req - Request with validated body { email, password }
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// PUBLIC_INTERFACE
/**
 * Get current authenticated user's profile.
 * GET /api/auth/me
 * @param {import('express').Request} req - Request with req.user from auth middleware
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getMe(req, res, next) {
  try {
    const userService = require('../services/users');
    const user = await userService.getById(req.user.id);
    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  signup,
  login,
  getMe,
};
