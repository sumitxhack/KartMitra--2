import app from './app';
import config from './config';
import logger from './utils/logger';
import { testConnection } from './config/database';
import { runMigrations } from './db/migrate';

/**
 * Startup process:
 * 1. Verify DB connection
 * 2. Run migrations
 * 3. Listen on HTTP port
 */
const startServer = async () => {
  try {
    // Verify PostgreSQL connection
    await testConnection();

    // Run schema migrations
    await runMigrations();

    // Boot Express HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`==================================================`);
      logger.info(`  KartMitra Backend Server Booted Successfully`);
      logger.info(`  Local Address: http://localhost:${config.port}`);
      logger.info(`  Environment:   ${config.env}`);
      logger.info(`==================================================`);
    });

    const exitHandler = () => {
      if (server) {
        logger.info('Closing server connection...');
        server.close(() => {
          logger.info('Server closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    const unexpectedErrorHandler = (error: Error) => {
      logger.error(`[Unexpected Error] ${error.stack || error.message}`);
      exitHandler();
    };

    process.on('uncaughtException', unexpectedErrorHandler);

    process.on('unhandledRejection', (reason: any) => {
      logger.error(`[Unhandled Promise Rejection] ${reason?.stack || reason}`);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received. Shutting down gracefully.');
      exitHandler();
    });
  } catch (error: any) {
    logger.error(`FATAL: Failed to boot KartMitra server: ${error.stack || error.message}`);
    process.exit(1);
  }
};

startServer();
