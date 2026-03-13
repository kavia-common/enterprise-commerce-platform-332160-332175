/**
 * Centralized application configuration.
 * All environment variables are read once here and exported as typed values.
 * No other module should read process.env directly.
 *
 * Contract:
 *   - Single source of truth for all configuration
 *   - All values are typed and have sensible development defaults
 *   - CORS origins automatically include FRONTEND_URL if set
 */
require('dotenv').config();

/**
 * Build the CORS allowed origins list.
 * Merges ALLOWED_ORIGINS with FRONTEND_URL to ensure the frontend
 * preview URL is always permitted.
 * @param {string} allowedOriginsEnv - Comma-separated origins from env
 * @param {string} frontendUrl - The frontend URL from env
 * @returns {string[]} De-duplicated list of allowed origins
 */
function buildAllowedOrigins(allowedOriginsEnv, frontendUrl) {
  const origins = (allowedOriginsEnv || 'http://localhost:3000,http://localhost:4000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Ensure FRONTEND_URL is always included in allowed origins
  if (frontendUrl && !origins.includes(frontendUrl)) {
    origins.push(frontendUrl);
  }

  // De-duplicate
  return [...new Set(origins)];
}

const frontendUrl = process.env.FRONTEND_URL || process.env.SITE_URL || '';
const backendUrl = process.env.BACKEND_URL || '';

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3001,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Database — connection string from database_postgresql/db_connection.txt
  databaseUrl: process.env.DATABASE_URL || 'postgresql://appuser:dbuser123@localhost:5000/myapp',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'enterprise-commerce-jwt-secret-dev-only',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',

  // Cross-service URLs (for CORS, redirects, documentation)
  frontendUrl,
  backendUrl,

  // CORS — automatically includes FRONTEND_URL
  allowedOrigins: buildAllowedOrigins(process.env.ALLOWED_ORIGINS, frontendUrl),
  allowedHeaders: (process.env.ALLOWED_HEADERS || 'Content-Type,Authorization,X-Requested-With').split(','),
  allowedMethods: (process.env.ALLOWED_METHODS || 'GET,POST,PUT,DELETE,PATCH,OPTIONS').split(','),
  corsMaxAge: parseInt(process.env.CORS_MAX_AGE, 10) || 3600,

  // Rate Limiting
  rateLimitWindowS: parseInt(process.env.RATE_LIMIT_WINDOW_S, 10) || 60,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Site URL (legacy alias for frontendUrl)
  siteUrl: process.env.SITE_URL || process.env.FRONTEND_URL || 'http://localhost:3000',
};

module.exports = config;
