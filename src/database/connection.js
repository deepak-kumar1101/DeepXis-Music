/**
 * DeepXis Music Bot - PostgreSQL Connection Pool
 * Manages database connections with automatic reconnection and fallback.
 */

const { Pool } = require('pg');
const config = require('../config/config');
const logger = require('../utils/logger');

let pool = null;
let isConnected = false;

if (config.database.url) {
  try {
    pool = new Pool({
      connectionString: config.database.url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    pool.on('error', (err) => {
      logger.error('Database', 'Unexpected error on idle PostgreSQL client', err);
      isConnected = false;
    });
  } catch (err) {
    logger.error('Database', 'Failed to initialize PostgreSQL pool', err);
    pool = null;
  }
} else {
  logger.warn('Database', 'No DATABASE_URL configured. Persistent database storage is disabled.');
}

/**
 * Execute a parameterized SQL query
 * @param {string} text SQL query
 * @param {any[]} params Parameter array
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  if (!pool || !isConnected) {
    logger.debug('Database', 'Database query skipped (database not connected or operating in fallback mode)');
    return { rows: [], rowCount: 0 };
  }

  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Database', `Executed query in ${duration}ms`, { text: text.substring(0, 100), rows: res.rowCount });
    return res;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      isConnected = false;
      logger.warn('Database', 'PostgreSQL connection lost. Falling back to in-memory mode.');
      return { rows: [], rowCount: 0 };
    }
    logger.error('Database', `Query execution failed: ${text.substring(0, 100)}`, err);
    throw err;
  }
}

/**
 * Test and verify PostgreSQL connection
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  if (!pool) return false;
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    isConnected = true;
    logger.info('Database', 'PostgreSQL connection successfully established.');
    return true;
  } catch (err) {
    isConnected = false;
    logger.warn('Database', `PostgreSQL connection check failed: ${err.message}. Operating in fallback mode.`);
    return false;
  }
}

/**
 * Check if the database is currently healthy
 * @returns {boolean}
 */
function isAvailable() {
  return isConnected && pool !== null;
}

/**
 * Gracefully close the database pool
 */
async function close() {
  if (pool) {
    await pool.end();
    logger.info('Database', 'PostgreSQL pool drained and closed.');
  }
}

module.exports = {
  query,
  testConnection,
  isAvailable,
  close
};
