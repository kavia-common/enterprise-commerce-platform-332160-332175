/**
 * Server Entry Point.
 * Starts the Express HTTP server, tests database connectivity,
 * and handles graceful shutdown.
 */
const config = require('./config');
const logger = require('./config/logger');
const app = require('./app');
const db = require('./db/pool');

async function startServer() {
  // Test database connection before starting
  const dbConnected = await db.testConnection();
  if (!dbConnected) {
    logger.warn('Database connection failed - server will start but DB features may not work');
  }

  const server = app.listen(config.port, config.host, () => {
    logger.info(`Server running at http://${config.host}:${config.port}`, {
      environment: config.nodeEnv,
      port: config.port,
    });
    logger.info(`API Documentation available at http://${config.host}:${config.port}/docs`);
  });

  // Graceful shutdown handler
  const shutdown = (signal) => {
    logger.info(`${signal} signal received: closing HTTP server`);
    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await db.pool.end();
        logger.info('Database pool closed');
      } catch (err) {
        logger.error('Error closing database pool', { error: err.message });
      }
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

startServer().catch((error) => {
  logger.error('Failed to start server', { error: error.message, stack: error.stack });
  process.exit(1);
});
