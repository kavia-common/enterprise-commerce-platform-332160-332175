/**
 * Server Entry Point.
 * Starts the Express HTTP server, tests database connectivity,
 * verifies seed data compatibility, and handles graceful shutdown.
 *
 * Flow: ServerStartupFlow
 * Entrypoint: startServer()
 * Contract:
 *   - Tests DB connection
 *   - Verifies seed password hashes are bcryptjs-compatible
 *   - Starts HTTP listener on configured host:port
 *   - Registers SIGTERM/SIGINT for graceful shutdown
 * Errors: Logs and exits with code 1 on fatal startup failure
 */
const config = require('./config');
const logger = require('./config/logger');
const app = require('./app');
const db = require('./db/pool');
const { verifySeedPasswords } = require('./db/seedCheck');

// PUBLIC_INTERFACE
/**
 * Start the Express HTTP server with database connectivity check
 * and seed data verification.
 * @returns {Promise<import('http').Server>} The running HTTP server instance
 */
async function startServer() {
  logger.info('ServerStartupFlow: starting', {
    environment: config.nodeEnv,
    port: config.port,
  });

  // Test database connection before starting
  const dbConnected = await db.testConnection();
  if (!dbConnected) {
    logger.warn('ServerStartupFlow: database connection failed - server will start but DB features may not work');
  } else {
    // Verify seed passwords are bcryptjs-compatible (non-blocking)
    try {
      await verifySeedPasswords();
    } catch (err) {
      logger.warn('ServerStartupFlow: seed verification encountered an error', { error: err.message });
    }
  }

  const server = app.listen(config.port, config.host, () => {
    logger.info(`ServerStartupFlow: server running at http://${config.host}:${config.port}`, {
      environment: config.nodeEnv,
      port: config.port,
    });
    logger.info(`ServerStartupFlow: API documentation at http://${config.host}:${config.port}/docs`);
    logger.info(`ServerStartupFlow: OpenAPI JSON at http://${config.host}:${config.port}/openapi.json`);
    if (config.frontendUrl) {
      logger.info(`ServerStartupFlow: frontend expected at ${config.frontendUrl}`);
    }
  });

  // Graceful shutdown handler
  const shutdown = (signal) => {
    logger.info(`ServerStartupFlow: ${signal} received, closing HTTP server`);
    server.close(async () => {
      logger.info('ServerStartupFlow: HTTP server closed');
      try {
        await db.pool.end();
        logger.info('ServerStartupFlow: database pool closed');
      } catch (err) {
        logger.error('ServerStartupFlow: error closing database pool', { error: err.message });
      }
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('ServerStartupFlow: forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

startServer().catch((error) => {
  logger.error('ServerStartupFlow: failed to start server', { error: error.message, stack: error.stack });
  process.exit(1);
});
