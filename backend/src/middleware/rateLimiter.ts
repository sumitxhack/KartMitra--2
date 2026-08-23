import rateLimit from 'express-rate-limit';
import config from '../config';
import { ApiResponse } from '../utils/apiResponse';

/**
 * Basic IP-based rate limiting middleware.
 */
export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(
      res,
      'Too many requests, please try again later.',
      { windowMs: config.rateLimit.windowMs, limit: config.rateLimit.max },
      429
    );
  },
});
