/**
 * DeepXis Music Bot - Structured Logger
 * Provides sanitized, timestamped console logging with log levels.
 * Prevents accidental credential leakage (tokens, passwords, secrets).
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const CURRENT_LEVEL = process.env.NODE_ENV === 'production' 
  ? LOG_LEVELS.INFO 
  : LOG_LEVELS.DEBUG;

function sanitize(message) {
  if (typeof message !== 'string') {
    try {
      message = JSON.stringify(message, null, 2);
    } catch {
      message = String(message);
    }
  }

  // Sanitize Discord token, Spotify secrets, Database passwords
  return message
    .replace(/[a-zA-Z0-9_-]{24,}\.[a-zA-Z0-9_-]{6,}\.[a-zA-Z0-9_-]{27,}/g, '[REDACTED_DISCORD_TOKEN]')
    .replace(/postgres(ql)?:\/\/[^:]+:([^@]+)@/g, 'postgresql://[REDACTED_DB_USER]:[REDACTED_PASSWORD]@')
    .replace(/(client_secret|secret|password|token)\s*[:=]\s*['"][^'"]+['"]/gi, '$1: "[REDACTED]"');
}

function formatLog(level, tag, message, meta) {
  const timestamp = new Date().toISOString();
  const sanitizedMsg = sanitize(message);
  const metaStr = meta ? ` | ${sanitize(meta)}` : '';
  return `[${timestamp}] [${level}] [${tag}] ${sanitizedMsg}${metaStr}`;
}

const logger = {
  debug(tag, message, meta) {
    if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
      console.debug(formatLog('DEBUG', tag, message, meta));
    }
  },

  info(tag, message, meta) {
    if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
      console.info(formatLog('INFO', tag, message, meta));
    }
  },

  warn(tag, message, meta) {
    if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
      console.warn(formatLog('WARN', tag, message, meta));
    }
  },

  error(tag, message, error) {
    if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
      const errorDetails = error && error.stack ? error.stack : error;
      console.error(formatLog('ERROR', tag, message, errorDetails));
    }
  }
};

module.exports = logger;
