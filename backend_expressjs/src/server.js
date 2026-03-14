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

const { authRouter } = require('./routes/auth');
const { activityRouter } = require('./routes/activity');
const { usersRouter } = require('./routes/users');

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

  app.use('/api/auth', authRouter);
  app.use('/api/admin/activity', activityRouter);
  app.use('/api/users', usersRouter);

  // Central error handler (must be last).
  app.use(errorMiddleware);

  return app;
}

const app = createApp();

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  logger.info({ op: 'server.listen', port }, 'Backend server listening');
});

module.exports = { createApp };
