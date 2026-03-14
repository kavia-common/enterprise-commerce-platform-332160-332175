'use strict';

const { z } = require('zod');
const { getPool } = require('../db/pool');
const { logger } = require('../shared/logger');
const { AppError } = require('../shared/errors');

const ActivityEventType = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  DATA_UPDATE: 'DATA_UPDATE'
};

const CreateActivityEventInputSchema = z.object({
  // Actor can be null for unauthenticated events (e.g., failed login could be added later)
  actorUserId: z.string().uuid().nullable().optional(),
  actorEmail: z.string().email().nullable().optional(),
  eventType: z.enum([ActivityEventType.LOGIN, ActivityEventType.LOGOUT, ActivityEventType.DATA_UPDATE]),
  // Resource and action provide filtering and context in admin UI.
  resourceType: z.string().min(1).max(64),
  resourceId: z.string().min(1).max(128).nullable().optional(),
  action: z.string().min(1).max(128),
  // Arbitrary JSON, must be serializable.
  metadata: z.record(z.any()).optional(),
  ipAddress: z.string().max(128).optional(),
  userAgent: z.string().max(512).optional(),
  requestId: z.string().max(128).optional()
});

const QueryActivityEventsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
  actorUserId: z.string().uuid().optional(),
  eventType: z.string().min(1).max(64).optional(),
  resourceType: z.string().min(1).max(64).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

// PUBLIC_INTERFACE
async function createActivityEvent(input) {
  /**
   * Reusable flow: ActivityLogFlow.createActivityEvent
   *
   * Contract:
   * - Inputs: CreateActivityEventInput
   * - Output: { id: string }
   * - Errors: AppError on validation/db errors
   * - Side effects: Inserts a row into user_activity_logs
   */
  const parsed = CreateActivityEventInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('Invalid activity event', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten()
    });
  }

  const event = parsed.data;
  const pool = getPool();

  logger.info(
    {
      op: 'ActivityLogFlow.createActivityEvent.start',
      eventType: event.eventType,
      resourceType: event.resourceType,
      action: event.action,
      actorUserId: event.actorUserId,
      requestId: event.requestId
    },
    'Creating activity event'
  );

  try {
    const result = await pool.query(
      `
      INSERT INTO user_activity_logs
        (actor_user_id, actor_email, event_type, resource_type, resource_id, action, metadata, ip_address, user_agent, request_id)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
      `,
      [
        event.actorUserId ?? null,
        event.actorEmail ?? null,
        event.eventType,
        event.resourceType,
        event.resourceId ?? null,
        event.action,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.ipAddress ?? null,
        event.userAgent ?? null,
        event.requestId ?? null
      ]
    );

    const id = result.rows[0]?.id;
    logger.info({ op: 'ActivityLogFlow.createActivityEvent.success', id }, 'Activity event created');
    return { id };
  } catch (e) {
    logger.error(
      { op: 'ActivityLogFlow.createActivityEvent.failure', errMessage: e?.message },
      'Failed to create activity event'
    );
    throw new AppError('Failed to create activity event', { statusCode: 500, code: 'DB_ERROR' });
  }
}

// PUBLIC_INTERFACE
async function queryActivityEvents(input) {
  /**
   * Reusable flow: ActivityLogFlow.queryActivityEvents
   *
   * Contract:
   * - Inputs: QueryActivityEventsInput
   * - Output: { items: ActivityEventRow[], total: number }
   * - Errors: AppError on validation/db errors
   * - Side effects: Reads from user_activity_logs
   */
  const parsed = QueryActivityEventsInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('Invalid query parameters', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten()
    });
  }

  const q = parsed.data;
  const pool = getPool();

  const where = [];
  const values = [];
  let idx = 1;

  if (q.actorUserId) {
    where.push(`actor_user_id = $${idx++}`);
    values.push(q.actorUserId);
  }
  if (q.eventType) {
    where.push(`event_type = $${idx++}`);
    values.push(q.eventType);
  }
  if (q.resourceType) {
    where.push(`resource_type = $${idx++}`);
    values.push(q.resourceType);
  }
  if (q.from) {
    where.push(`created_at >= $${idx++}`);
    values.push(q.from);
  }
  if (q.to) {
    where.push(`created_at <= $${idx++}`);
    values.push(q.to);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  logger.info(
    { op: 'ActivityLogFlow.queryActivityEvents.start', filters: { ...q, limit: q.limit, offset: q.offset } },
    'Querying activity events'
  );

  try {
    const totalRes = await pool.query(`SELECT COUNT(*)::int AS count FROM user_activity_logs ${whereSql}`, values);
    const total = totalRes.rows[0]?.count ?? 0;

    const itemsRes = await pool.query(
      `
      SELECT
        id,
        created_at,
        actor_user_id,
        actor_email,
        event_type,
        resource_type,
        resource_id,
        action,
        metadata,
        ip_address,
        user_agent,
        request_id
      FROM user_activity_logs
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
      `,
      [...values, q.limit, q.offset]
    );

    return { items: itemsRes.rows, total };
  } catch (e) {
    logger.error({ op: 'ActivityLogFlow.queryActivityEvents.failure', errMessage: e?.message }, 'Failed to query logs');
    throw new AppError('Failed to query activity events', { statusCode: 500, code: 'DB_ERROR' });
  }
}

module.exports = { ActivityEventType, createActivityEvent, queryActivityEvents };
