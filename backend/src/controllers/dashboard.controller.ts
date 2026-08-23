import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { ApiResponse } from '../utils/apiResponse';

export class DashboardController {
  /**
   * Get main metrics summary.
   */
  static async getSummary(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const summary = await DashboardService.getSummary();
      return ApiResponse.success(res, 'Dashboard summary retrieved (Mock)', summary);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get sales trend and revenue statistics.
   */
  static async getSales(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const sales = await DashboardService.getSalesData();
      return ApiResponse.success(res, 'Dashboard sales data retrieved (Mock)', sales);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get inventory stock levels summary.
   */
  static async getInventory(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const inventory = await DashboardService.getInventoryData();
      return ApiResponse.success(res, 'Dashboard inventory data retrieved (Mock)', inventory);
    } catch (error) {
      return next(error);
    }
  }
}
