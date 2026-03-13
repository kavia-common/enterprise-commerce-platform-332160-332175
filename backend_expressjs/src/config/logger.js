/**
 * Centralized Winston logger configuration.
 * Provides structured, consistent logging across all modules.
 */
const winston = require('winston');
const config = require('./index');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// PUBLIC_INTERFACE
/**
 * Application logger instance.
 * Provides structured logging with timestamp, level, and metadata support.
 * Usage: logger.info('message', { key: 'value' })
 */
const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { service: 'enterprise-commerce-api' },
  transports: [
    new winston.transports.Console({
      format: config.isProduction ? logFormat : consoleFormat,
    }),
  ],
});

module.exports = logger;
