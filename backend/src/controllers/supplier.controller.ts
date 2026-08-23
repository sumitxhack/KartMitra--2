import { Request, Response, NextFunction } from 'express';
import { SupplierService } from '../services/supplier.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export class SupplierController {
  /**
   * Get all suppliers.
   */
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const suppliers = await SupplierService.getAll();
      return ApiResponse.success(res, 'Suppliers retrieved successfully (Mock)', suppliers);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get supplier by ID.
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;
      const supplier = await SupplierService.getById(id);

      if (!supplier) {
        return next(new ApiError(404, `Supplier with ID ${id} not found`));
      }

      return ApiResponse.success(res, 'Supplier retrieved successfully (Mock)', supplier);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create new supplier.
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const supplier = await SupplierService.create(req.body);
      return ApiResponse.success(res, 'Supplier created successfully (Mock)', supplier, 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update existing supplier.
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;
      const updatedSupplier = await SupplierService.update(id, req.body);

      if (!updatedSupplier) {
        return next(new ApiError(404, `Supplier with ID ${id} not found`));
      }

      return ApiResponse.success(res, 'Supplier updated successfully (Mock)', updatedSupplier);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete supplier.
   */
  static async delete(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;
      const success = await SupplierService.delete(id);

      if (!success) {
        return next(new ApiError(404, `Supplier with ID ${id} not found`));
      }

      return ApiResponse.success(res, 'Supplier deleted successfully (Mock)', {});
    } catch (error) {
      return next(error);
    }
  }
}
