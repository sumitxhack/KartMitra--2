import { Router, Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse';

const router = Router();

/**
 * GET /api/v1/health
 * Returns status check of backend and mock connection check for database.
 */
router.get('/', (req: Request, res: Response) => {
  return ApiResponse.success(res, 'KartMitra backend is running', {
    server: 'ok',
    database: 'not_connected',
  });
});

export default router;
