/**
 * DeepXis Music Bot - Database Migration Runner
 * Automatically applies SQL migrations on startup or via npm run migrate.
 */

const fs = require('fs');
const path = require('path');
const db = require('./connection');
const logger = require('../utils/logger');

async function runMigrations() {
  if (!db.isAvailable() && !(await db.testConnection())) {
    logger.warn('Migrations', 'Database not reachable. Skipping migrations.');
    return false;
  }

  try {
    // 1. Create migrations tracking table if not present
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Read migration files from src/database/migrations
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      logger.warn('Migrations', `Migrations directory not found at ${migrationsDir}`);
      return true;
    }

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    // 3. Query already applied migrations
    const appliedResult = await db.query('SELECT name FROM schema_migrations;');
    const appliedSet = new Set(appliedResult.rows.map(r => r.name));

    for (const file of files) {
      if (!appliedSet.has(file)) {
        logger.info('Migrations', `Applying migration: ${file}...`);
        const sqlPath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Run SQL script
        await db.query(sql);

        // Record migration
        await db.query('INSERT INTO schema_migrations (name) VALUES ($1);', [file]);
        logger.info('Migrations', `Migration ${file} applied successfully.`);
      }
    }

    logger.info('Migrations', 'All database migrations up to date.');
    return true;
  } catch (err) {
    logger.error('Migrations', 'Migration execution failed', err);
    return false;
  }
}

// Allow direct execution via CLI (node src/database/migrate.js)
if (require.main === module) {
  runMigrations().then(() => {
    db.close().then(() => process.exit(0));
  }).catch((err) => {
    logger.error('Migrations', 'CLI Migration runner failed', err);
    process.exit(1);
  });
}

module.exports = { runMigrations };
