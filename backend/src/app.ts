import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config';
import routes from './routes';
import { apiRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { ApiError } from './utils/apiError';
import logger from './utils/logger';

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

// Payload size limits & json parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Custom stream to direct morgan HTTP request logs to winston
const morganFormat = config.env === 'production' ? 'combined' : 'dev';
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message: string) => logger.info(`[HTTP] ${message.trim()}`),
    },
  })
);

// Rate limiter for security (applied to all /api/ requests)
app.use('/api/', apiRateLimiter);

// Base route mounting
app.use('/api/v1', routes);

// 404 fallback for unmatched routes
app.use((req, res, next) => {
  return next(new ApiError(404, `Cannot find ${req.method} ${req.originalUrl}`));
});

// Centralized error handler middleware
app.use(errorHandler);

export default app;
