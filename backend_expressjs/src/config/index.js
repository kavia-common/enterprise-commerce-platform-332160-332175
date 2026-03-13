/**
 * Centralized application configuration.
 * All environment variables are read once here and exported as typed values.
 * No other module should read process.env directly.
 */
require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3001,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://appuser:dbuser123@localhost:5000/myapp',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'enterprise-commerce-jwt-secret-dev-only',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',

  // CORS
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:4000').split(','),
  allowedHeaders: (process.env.ALLOWED_HEADERS || 'Content-Type,Authorization,X-Requested-With').split(','),
  allowedMethods: (process.env.ALLOWED_METHODS || 'GET,POST,PUT,DELETE,PATCH,OPTIONS').split(','),
  corsMaxAge: parseInt(process.env.CORS_MAX_AGE, 10) || 3600,

  // Rate Limiting
  rateLimitWindowS: parseInt(process.env.RATE_LIMIT_WINDOW_S, 10) || 60,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Site URL
  siteUrl: process.env.SITE_URL || 'http://localhost:3000',
};

module.exports = config;
