'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const { AppError } = require('../shared/errors');
const { ActivityEventType, createActivityEvent } = require('../flows/activityLogFlow');

const authRouter = express.Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// NOTE: This template does not implement full users table/password hashing.
// It issues JWTs for any login to keep the focus on the Activity Log feature.
// In a real app, validate credentials against users table, compare bcrypt hashes, etc.
authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid login payload', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten()
      });
    }

    const { email } = parsed.data;

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required');

    // Simple role inference for template: emails ending in @admin.test become admin.
    const role = email.toLowerCase().endsWith('@admin.test') ? 'admin' : 'user';

    // Generate deterministic UUID-like value is not feasible without DB here; use random UUID.
    const sub = require('crypto').randomUUID();

    const token = jwt.sign({ sub, email, role }, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });

    await createActivityEvent({
      actorUserId: sub,
      actorEmail: email,
      eventType: ActivityEventType.LOGIN,
      resourceType: 'AUTH',
      resourceId: null,
      action: 'login',
      metadata: { role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.kavia?.requestId
    });

    res.json({ token, user: { id: sub, email, role } });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    // Stateless JWT logout: client discards token.
    // Still record an event (actor unknown if token not supplied).
    const auth = req.headers.authorization || '';
    const [type, token] = auth.split(' ');
    let actorUserId = null;
    let actorEmail = null;

    if (type === 'Bearer' && token) {
      try {
        const secret = process.env.JWT_SECRET;
        if (secret) {
          const payload = jwt.verify(token, secret);
          actorUserId = payload.sub || null;
          actorEmail = payload.email || null;
        }
      } catch (_e) {
        // ignore invalid token for logout logging; the action is still "logout attempted"
      }
    }

    await createActivityEvent({
      actorUserId,
      actorEmail,
      eventType: ActivityEventType.LOGOUT,
      resourceType: 'AUTH',
      resourceId: null,
      action: 'logout',
      metadata: {},
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.kavia?.requestId
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = { authRouter };
