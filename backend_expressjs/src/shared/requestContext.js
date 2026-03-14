'use strict';

const crypto = require('crypto');

/**
 * Generates a request-scoped context object.
 * Stored on req.kavia to avoid collisions with userland fields.
 */
function requestContextMiddleware() {
  return (req, _res, next) => {
    req.kavia = req.kavia || {};
    req.kavia.requestId = crypto.randomUUID();
    req.kavia.startTimeMs = Date.now();
    next();
  };
}

module.exports = { requestContextMiddleware };
