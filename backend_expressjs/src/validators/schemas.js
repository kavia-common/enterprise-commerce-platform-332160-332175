/**
 * Joi Validation Schemas.
 * Centralized input validation for all API endpoints.
 * Each schema defines the contract for acceptable request data.
 */
const Joi = require('joi');

// ── Auth Schemas ──

// PUBLIC_INTERFACE
/** Schema for user signup request body */
const signupSchema = Joi.object({
  email: Joi.string().email().max(255).required()
    .messages({ 'string.email': 'Please provide a valid email address' }),
  password: Joi.string().min(8).max(128).required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
      'string.min': 'Password must be at least 8 characters long',
    }),
  first_name: Joi.string().max(100).required().trim(),
  last_name: Joi.string().max(100).required().trim(),
  role: Joi.string().valid('admin', 'customer').default('customer'),
});

// PUBLIC_INTERFACE
/** Schema for user login request body */
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// ── User Schemas ──

// PUBLIC_INTERFACE
/** Schema for updating a user */
const updateUserSchema = Joi.object({
  email: Joi.string().email().max(255),
  first_name: Joi.string().max(100).trim(),
  last_name: Joi.string().max(100).trim(),
  role: Joi.string().valid('admin', 'customer'),
  is_active: Joi.boolean(),
}).min(1);

// ── Product Schemas ──

// PUBLIC_INTERFACE
/** Schema for creating a product */
const createProductSchema = Joi.object({
  name: Joi.string().max(255).required().trim(),
  description: Joi.string().allow('', null),
  price: Joi.number().min(0).precision(2).required(),
  stock_quantity: Joi.number().integer().min(0).default(0),
  category: Joi.string().max(100).allow('', null),
  sku: Joi.string().max(100).required().trim(),
  image_url: Joi.string().uri().max(500).allow('', null),
  is_active: Joi.boolean().default(true),
});

// PUBLIC_INTERFACE
/** Schema for updating a product */
const updateProductSchema = Joi.object({
  name: Joi.string().max(255).trim(),
  description: Joi.string().allow('', null),
  price: Joi.number().min(0).precision(2),
  stock_quantity: Joi.number().integer().min(0),
  category: Joi.string().max(100).allow('', null),
  sku: Joi.string().max(100).trim(),
  image_url: Joi.string().uri().max(500).allow('', null),
  is_active: Joi.boolean(),
}).min(1);

// ── Order Schemas ──

// PUBLIC_INTERFACE
/** Schema for creating an order */
const createOrderSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.string().uuid().required(),
      quantity: Joi.number().integer().min(1).required(),
    })
  ).min(1).required(),
  shipping_address: Joi.string().allow('', null),
  billing_address: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
});

// PUBLIC_INTERFACE
/** Schema for updating an order status */
const updateOrderSchema = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'),
  shipping_address: Joi.string().allow('', null),
  billing_address: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
}).min(1);

// ── Pagination Schema ──

// PUBLIC_INTERFACE
/** Schema for pagination query parameters */
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort_by: Joi.string().default('created_at'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc'),
});

// ── UUID Param Schema ──

// PUBLIC_INTERFACE
/** Schema for validating UUID path parameters */
const uuidParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

module.exports = {
  signupSchema,
  loginSchema,
  updateUserSchema,
  createProductSchema,
  updateProductSchema,
  createOrderSchema,
  updateOrderSchema,
  paginationSchema,
  uuidParamSchema,
};
