import { Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services/inventory.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export class InventoryController {
  /**
   * Get all inventory items.
   */
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const inventory = await InventoryService.getAll();
      return ApiResponse.success(res, 'Inventory retrieved successfully (Mock)', inventory);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get inventory item by product ID.
   */
  static async getByProductId(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { productId } = req.params;
      const item = await InventoryService.getByProductId(productId);

      if (!item) {
        return next(new ApiError(404, `Inventory record for Product ID ${productId} not found`));
      }

      return ApiResponse.success(res, 'Inventory record retrieved successfully (Mock)', item);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all items that are low in stock.
   */
  static async getLowStock(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const items = await InventoryService.getLowStock();
      return ApiResponse.success(res, 'Low stock inventory retrieved successfully (Mock)', items);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Adjust inventory stock levels (increment/decrement).
   */
  static async adjust(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { productId, adjustment } = req.body;
      const updatedItem = await InventoryService.adjustStock(productId, adjustment);

      if (!updatedItem) {
        return next(new ApiError(404, `Product ID ${productId} not found in inventory`));
      }

      return ApiResponse.success(res, 'Stock level adjusted successfully (Mock)', updatedItem);
    } catch (error) {
      return next(error);
    }
  }
}
