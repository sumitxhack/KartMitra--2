import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import { AuthService } from '../services/auth.service';
import { ApiError } from '../utils/apiError';
import { AuthRequest } from '../middleware/auth.middleware';

export class AuthController {
  /**
   * Mock User Registration.
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { email, password, name } = req.body;

      const mockUser = {
        id: 'mock-user-' + Math.random().toString(36).substring(2, 9),
        name: name || 'New User',
        email,
        role: 'user',
      };

      const token = AuthService.generateToken(mockUser);

      return ApiResponse.success(res, 'Registration successful (Mock)', {
        user: mockUser,
        token,
      }, 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Mock User Login.
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { email, password } = req.body;

      // Allow any password in mock environment. Admin email returns admin role.
      const isAdmin = email === 'admin@kartmitra.com';
      const mockUser = {
        id: isAdmin ? 'mock-user-id-123' : 'mock-user-' + Math.random().toString(36).substring(2, 9),
        name: isAdmin ? 'Admin User' : 'Mock User',
        email,
        role: isAdmin ? 'admin' : 'user',
      };

      const token = AuthService.generateToken(mockUser);

      return ApiResponse.success(res, 'Login successful (Mock)', {
        user: mockUser,
        token,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Mock Logout.
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      return ApiResponse.success(res, 'Logout successful (Mock)', {});
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get Current Authenticated User profile.
   */
  static async me(req: AuthRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      if (!req.user) {
        return next(new ApiError(401, 'Unauthorized'));
      }

      return ApiResponse.success(res, 'User profile retrieved (Mock)', {
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          name: req.user.role === 'admin' ? 'Admin User' : 'Mock User',
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}
