/**
 * Authentication Service.
 * Handles user registration, login, and JWT token generation.
 *
 * Flow: AuthFlow
 * Entrypoint: signup(), login()
 * Contract:
 *   signup - creates user with hashed password, returns user + token
 *   login - verifies credentials, returns user + token
 * Errors: ConflictError (duplicate email), UnauthorizedError (bad credentials)
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/pool');
const logger = require('../config/logger');
const { ConflictError, UnauthorizedError } = require('../errors/AppError');

const SALT_ROUNDS = 12;

/**
 * Generate a JWT token for a user.
 * @param {object} user - User object with id, email, role
 * @returns {string} Signed JWT token
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

/**
 * Sanitize user object for API response (remove password_hash).
 * @param {object} user - Raw user row from database
 * @returns {object} User without sensitive fields
 */
function sanitizeUser(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

// PUBLIC_INTERFACE
/**
 * Register a new user.
 * @param {object} data - { email, password, first_name, last_name, role? }
 * @returns {Promise<{user: object, token: string}>} Created user and JWT token
 * @throws {ConflictError} If email already exists
 */
async function signup(data) {
  logger.info('AuthFlow: signup started', { email: data.email });

  // Check for existing user
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [data.email]);
  if (existing.rows.length > 0) {
    throw new ConflictError('A user with this email already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  // Insert user
  const result = await db.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.email, passwordHash, data.first_name, data.last_name, data.role || 'customer']
  );

  const user = result.rows[0];
  const token = generateToken(user);

  logger.info('AuthFlow: signup completed', { userId: user.id, email: user.email });
  return { user: sanitizeUser(user), token };
}

// PUBLIC_INTERFACE
/**
 * Authenticate a user with email and password.
 * @param {object} data - { email, password }
 * @returns {Promise<{user: object, token: string}>} Authenticated user and JWT token
 * @throws {UnauthorizedError} If credentials are invalid
 */
async function login(data) {
  logger.info('AuthFlow: login started', { email: data.email });

  const result = await db.query('SELECT * FROM users WHERE email = $1', [data.email]);
  const user = result.rows[0];

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.is_active) {
    throw new UnauthorizedError('Account is deactivated');
  }

  const isMatch = await bcrypt.compare(data.password, user.password_hash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = generateToken(user);

  logger.info('AuthFlow: login completed', { userId: user.id, email: user.email });
  return { user: sanitizeUser(user), token };
}

module.exports = {
  signup,
  login,
  generateToken,
  sanitizeUser,
};
