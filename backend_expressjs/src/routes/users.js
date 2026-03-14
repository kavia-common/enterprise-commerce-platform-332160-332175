'use strict';

const express = require('express');
const { z } = require('zod');

const { requireAuth } = require('../middlewares/auth');
const { AppError } = require('../shared/errors');
const { ActivityEventType, createActivityEvent } = require('../flows/activityLogFlow');

const usersRouter = express.Router();

const UpdateUserSchema = z.object({
  displayName: z.string().min(1).max(128).optional(),
  phone: z.string().min(3).max(32).optional()
});

// PUBLIC_INTERFACE
usersRouter.patch('/me', requireAuth, async (req, res, next) => {
  /**
   * Update current user's profile.
   * This template does not persist user profile changes (no users table yet),
   * but still records the update intent as an activity event.
   */
  try {
    const parsed = UpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid update payload', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten()
      });
    }

    // Here you would update users table; for now echo back.
    const updates = parsed.data;

    await createActivityEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      eventType: ActivityEventType.DATA_UPDATE,
      resourceType: 'USER',
      resourceId: req.user.id,
      action: 'update_profile',
      metadata: { updatedFields: Object.keys(updates) },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.kavia?.requestId
    });

    res.json({ ok: true, user: { id: req.user.id, email: req.user.email, ...updates } });
  } catch (e) {
    next(e);
  }
});

module.exports = { usersRouter };
