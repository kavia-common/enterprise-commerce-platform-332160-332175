'use strict';

const express = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const { queryActivityEvents } = require('../flows/activityLogFlow');

const activityRouter = express.Router();

/**
 * Admin endpoint: list user activity logs with filters.
 * Query params:
 * - limit, offset
 * - actorUserId
 * - eventType
 * - resourceType
 * - from, to (ISO datetime strings)
 */
activityRouter.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const result = await queryActivityEvents({
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
      actorUserId: req.query.actorUserId || undefined,
      eventType: req.query.eventType || undefined,
      resourceType: req.query.resourceType || undefined,
      from: req.query.from || undefined,
      to: req.query.to || undefined
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});

module.exports = { activityRouter };
