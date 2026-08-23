import { Pool } from 'pg';
import config from './index';
import logger from '../utils/logger';

// Create PostgreSQL connection pool
export const pool = new Pool({
  connectionString: config.database.url,
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // return an error after 2 seconds if connection cannot be established
});

// Log unexpected errors on idle pool clients
pool.on('error', (err) => {
  logger.error(`Unexpected database pool client error: ${err.stack || err.message}`);
});

/**
 * Verifies that the server can connect to the database.
 */
export const testConnection = async (): Promise<boolean> => {
  let client;
  try {
    client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    logger.info(`[Database] Connection verified. Current DB timestamp: ${res.rows[0].now}`);
    return true;
  } catch (error: any) {
    logger.error(`[Database] Connection verification failed: ${error.message}`);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};
