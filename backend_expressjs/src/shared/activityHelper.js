'use strict';

const { ActivityEventType, createActivityEvent } = require('../flows/activityLogFlow');
const { logger } = require('./logger');

/**
 * Supported CRUD actions mapped to human-readable action strings.
 * Centralizes action naming to prevent inconsistencies across routes.
 */
const CrudAction = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete'
};

// PUBLIC_INTERFACE
/**
 * Log a CRUD activity event using the shared ActivityLogFlow.
 *
 * Contract:
 * - Inputs:
 *   @param {object} req - Express request object (must have req.user, req.kavia, req.ip, req.headers)
 *   @param {string} resourceType - The type of resource (e.g., 'PRODUCT', 'ORDER')
 *   @param {string} resourceId - The ID of the resource being acted upon (nullable)
 *   @param {string} action - The CRUD action performed (use CrudAction constants)
 *   @param {object} [metadata={}] - Optional additional metadata to store with the event
 * - Output: { id: string } from the created activity event
 * - Errors: Logs warning on failure but does NOT throw — activity logging must not break the main request flow
 * - Side effects: Inserts a row into user_activity_logs via ActivityLogFlow
 */
async function logCrudActivity(req, resourceType, resourceId, action, metadata = {}) {
  try {
    const actorUserId = req.user?.id || null;
    const actorEmail = req.user?.email || null;

    const result = await createActivityEvent({
      actorUserId,
      actorEmail,
      eventType: ActivityEventType.DATA_UPDATE,
      resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      action,
      metadata,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.kavia?.requestId
    });

    return result;
  } catch (err) {
    // Activity logging failures must not break the main request.
    // Log the error for observability but allow the response to proceed.
    logger.warn(
      {
        op: 'activityHelper.logCrudActivity.failure',
        resourceType,
        resourceId,
        action,
        errMessage: err?.message
      },
      'Failed to log CRUD activity event (non-fatal)'
    );
    return null;
  }
}

module.exports = { logCrudActivity, CrudAction };
