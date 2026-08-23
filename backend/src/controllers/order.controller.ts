import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/order.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export class OrderController {
  /**
   * Get all orders.
   */
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const orders = await OrderService.getAll();
      return ApiResponse.success(res, 'Orders retrieved successfully (Mock)', orders);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get order by ID.
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;
      const order = await OrderService.getById(id);

      if (!order) {
        return next(new ApiError(404, `Order with ID ${id} not found`));
      }

      return ApiResponse.success(res, 'Order retrieved successfully (Mock)', order);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create new order.
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const order = await OrderService.create(req.body);
      return ApiResponse.success(res, 'Order created successfully (Mock)', order, 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update order status.
   */
  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updatedOrder = await OrderService.updateStatus(id, status);

      if (!updatedOrder) {
        return next(new ApiError(404, `Order with ID ${id} not found`));
      }

      return ApiResponse.success(res, 'Order status updated successfully (Mock)', updatedOrder);
    } catch (error) {
      return next(error);
    }
  }
}
