/**
 * Main Router.
 * Mounts all route modules under their respective base paths.
 * This is the single routing entrypoint used by app.js.
 */
const express = require('express');
const healthController = require('../controllers/health');
const authRoutes = require('./auth');
const usersRoutes = require('./users');
const productsRoutes = require('./products');
const ordersRoutes = require('./orders');

const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     tags: [Health]
 *     summary: Health endpoint
 *     description: Service health check
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

// Mount API route modules
router.use('/api/auth', authRoutes);
router.use('/api/users', usersRoutes);
router.use('/api/products', productsRoutes);
router.use('/api/orders', ordersRoutes);

module.exports = router;
