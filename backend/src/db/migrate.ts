import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import logger from '../utils/logger';

/**
 * Runs pending database migrations.
 */
export const runMigrations = async (): Promise<void> => {
  logger.info('[Migrations] Checking database migrations...');

  const client = await pool.connect();
  try {
    // Create tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Dynamically locate the migrations directory
    const cwd = process.cwd();
    let migrationsDir = path.join(cwd, 'src/db/migrations');

    // Fallback if running outside backend folder
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.join(cwd, 'backend/src/db/migrations');
    }

    // Fallback to built transpiled folder check
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.join(__dirname, 'migrations');
    }

    if (!fs.existsSync(migrationsDir)) {
      logger.error(`[Migrations] Migrations directory could not be located at: ${migrationsDir}`);
      throw new Error('Migrations directory not found');
    }

    // Read and sort migrations
    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    // Query applied migrations
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const appliedMigrations = new Set(rows.map((r: { name: string }) => r.name));

    // Execute pending migrations in transaction
    for (const file of files) {
      if (appliedMigrations.has(file)) {
        logger.info(`[Migrations] Skipping: ${file} (already applied)`);
        continue;
      }

      logger.info(`[Migrations] Applying: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        logger.info(`[Migrations] Completed: ${file} applied successfully.`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        logger.error(`[Migrations] Failed applying: ${file}. Error: ${err.message}`);
        throw err;
      }
    }

    logger.info('[Migrations] Database migrations check finished.');
  } catch (error: any) {
    logger.error(`[Migrations] Unexpected migration failure: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
};
