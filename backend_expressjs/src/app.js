/**
 * Express Application Setup.
 * Configures middleware stack, mounts routes, and registers error handling.
 *
 * Middleware order:
 * 1. Security (helmet, CORS)
 * 2. Request parsing (JSON)
 * 3. Logging (morgan)
 * 4. Rate limiting
 * 5. Swagger docs
 * 6. Routes
 * 7. 404 handler
 * 8. Centralized error handler
 */
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');
const config = require('./config');
const logger = require('./config/logger');
const routes = require('./routes');
const { errorHandler } = require('./middleware');
const { NotFoundError } = require('./errors/AppError');

// Initialize express app
const app = express();

// ── Security Middleware ──
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : '*',
  methods: config.allowedMethods,
  allowedHeaders: config.allowedHeaders,
  credentials: true,
  maxAge: config.corsMaxAge,
}));

app.set('trust proxy', true);

// ── Request Parsing ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HTTP Request Logging ──
const morganStream = {
  write: (message) => logger.info(message.trim(), { source: 'http' }),
};
app.use(morgan('combined', { stream: morganStream }));

// ── Rate Limiting ──
const limiter = rateLimit({
  windowMs: config.rateLimitWindowS * 1000,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many requests, please try again later',
  },
});
app.use(limiter);

// ── Swagger Documentation ──
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const host = req.get('host');
  let protocol = req.protocol;
  const actualPort = req.socket.localPort;
  const hasPort = host.includes(':');

  const needsPort =
    !hasPort &&
    ((protocol === 'http' && actualPort !== 80) ||
     (protocol === 'https' && actualPort !== 443));
  const fullHost = needsPort ? `${host}:${actualPort}` : host;
  protocol = req.secure ? 'https' : protocol;

  const dynamicSpec = {
    ...swaggerSpec,
    servers: [
      {
        url: `${protocol}://${fullHost}`,
        description: 'Current server',
      },
    ],
  };
  swaggerUi.setup(dynamicSpec)(req, res, next);
});

// Serve raw OpenAPI JSON
app.get('/openapi.json', (req, res) => {
  const host = req.get('host');
  let protocol = req.protocol;
  protocol = req.secure ? 'https' : protocol;

  const spec = {
    ...swaggerSpec,
    servers: [
      {
        url: `${protocol}://${host}`,
        description: 'Current server',
      },
    ],
  };
  res.json(spec);
});

// ── Mount Routes ──
app.use('/', routes);

// ── 404 Handler ──
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
});

// ── Centralized Error Handler (must be last) ──
app.use(errorHandler);

module.exports = app;
