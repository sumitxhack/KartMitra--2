import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { ApiError } from '../utils/apiError';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Authentication middleware that verifies JWT tokens.
 * Supports a special `mock-jwt-token-for-testing` token for testing without a database.
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Authentication token required'));
  }

  const token = authHeader.split(' ')[1];

  // Helper mock token for frontend development/testing
  if (token === 'mock-jwt-token-for-testing') {
    req.user = {
      id: 'mock-user-id-123',
      email: 'admin@kartmitra.com',
      role: 'admin',
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      email: string;
      role: string;
    };
    req.user = decoded;
    return next();
  } catch (error) {
    return next(new ApiError(401, 'Invalid or expired authentication token'));
  }
};
