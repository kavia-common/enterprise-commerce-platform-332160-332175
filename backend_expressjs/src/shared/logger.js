'use strict';

/**
 * Simple JSON logger wrapper.
 * In larger deployments, swap this with pino/winston without changing call sites.
 */
const levelPriority = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function shouldLog(level) {
  const configured = (process.env.LOG_LEVEL || 'info').toLowerCase();
  const c = levelPriority[configured] ?? levelPriority.info;
  const l = levelPriority[level] ?? levelPriority.info;
  return l >= c;
}

function log(level, obj, msg) {
  if (!shouldLog(level)) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    ...obj,
    msg
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

const logger = {
  debug: (obj, msg) => log('debug', obj || {}, msg),
  info: (obj, msg) => log('info', obj || {}, msg),
  warn: (obj, msg) => log('warn', obj || {}, msg),
  error: (obj, msg) => log('error', obj || {}, msg)
};

module.exports = { logger };
