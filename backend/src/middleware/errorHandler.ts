import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { ApiResponse } from '../utils/apiResponse';
import logger from '../utils/logger';
import config from '../config';

/**
 * Centralized error handler middleware.
 */
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  let statusCode = 500;
  let message = 'Something went wrong';
  let errorData: any = {};

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errorData = err.errorData;
  } else {
    // Internal server errors are logged
    logger.error(`[Unhandled Error] ${err.stack || err.message}`);
  }

  if (config.env === 'development') {
    logger.warn(`[API Error] ${statusCode} - ${message} - Route: ${req.method} ${req.originalUrl}`);
  }

  // Security: Do not expose raw internal error traces in production
  const isProduction = config.env === 'production';
  
  const responseMessage = isProduction && statusCode === 500
    ? 'Internal Server Error'
    : message;

  const errorResponse = {
    ...(Object.keys(errorData).length > 0 ? { details: errorData } : {}),
    ...(!isProduction ? { stack: err.stack } : {})
  };

  return ApiResponse.error(res, responseMessage, errorResponse, statusCode);
};
