'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { buildCorsOptions } = require('./shared/cors');
const { requestContextMiddleware } = require('./shared/requestContext');
const { errorMiddleware } = require('./shared/errors');
const { logger } = require('./shared/logger');
const { initDatabase } = require('./db/init');

const { authRouter } = require('./routes/auth');
const { activityRouter } = require('./routes/activity');
const { usersRouter } = require('./routes/users');
const { productsRouter } = require('./routes/products');
const { ordersRouter } = require('./routes/orders');

/**
 * Create and configure the Express application.
 * Kept as a separate factory to support testing / future serverless migration.
 */
function createApp() {
  const app = express();

  app.set('trust proxy', (process.env.TRUST_PROXY || '').toLowerCase() === 'true');

  app.use(helmet());
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('combined'));

  app.use(
    rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_S || 60) * 1000,
      limit: Number(process.env.RATE_LIMIT_MAX || 100),
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  // Attach request-scoped context (requestId, startTime) for logs and activity events.
  app.use(requestContextMiddleware());

  /**
   * Healthcheck endpoint for deployments / monitoring.
   */
  app.get('/healthz', (req, res) => {
    res.json({ ok: true });
  });

  // Auth routes (login, logout)
  app.use('/api/auth', authRouter);

  // Admin activity log viewer
  app.use('/api/admin/activity', activityRouter);

  // User profile management
  app.use('/api/users', usersRouter);

  // Product CRUD (public read, admin write) — all mutations logged via ActivityLogFlow
  app.use('/api/products', productsRouter);

  // Order CRUD (authenticated, role-scoped) — all mutations logged via ActivityLogFlow
  app.use('/api/orders', ordersRouter);

  // Central error handler (must be last).
  app.use(errorMiddleware);

  return app;
}

const app = createApp();

const port = Number(process.env.PORT || 3001);
app.listen(port, async () => {
  logger.info({ op: 'server.listen', port }, 'Backend server listening');

  // Initialize database tables (non-blocking, non-fatal on failure)
  try {
    await initDatabase();
  } catch (err) {
    logger.error(
      { op: 'server.dbInit.failure', errMessage: err?.message },
      'Database initialization failed — server continues running'
    );
  }
});

module.exports = { createApp };
