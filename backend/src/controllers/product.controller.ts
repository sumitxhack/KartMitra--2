import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export class ProductController {
  /**
   * Get all products.
   */
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const products = await ProductService.getAll();
      return ApiResponse.success(res, 'Products retrieved successfully', products);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get product by ID.
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;
      const product = await ProductService.getById(id);
      
      if (!product) {
        return next(new ApiError(404, `Product with ID ${id} not found`));
      }
      
      return ApiResponse.success(res, 'Product retrieved successfully', product);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get product by barcode.
   */
  static async getByBarcode(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { barcode } = req.params;
      const product = await ProductService.getByBarcode(barcode);
      
      if (!product) {
        return next(new ApiError(404, `Product with barcode ${barcode} not found`));
      }
      
      return ApiResponse.success(res, 'Product retrieved successfully by barcode', product);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create new product.
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const product = await ProductService.create(req.body);
      return ApiResponse.success(res, 'Product created successfully', product, 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update existing product.
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;
      const updatedProduct = await ProductService.update(id, req.body);

      if (!updatedProduct) {
        return next(new ApiError(404, `Product with ID ${id} not found`));
      }

      return ApiResponse.success(res, 'Product updated successfully', updatedProduct);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete product.
   */
  static async delete(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;
      const success = await ProductService.delete(id);

      if (!success) {
        return next(new ApiError(404, `Product with ID ${id} not found`));
      }

      return ApiResponse.success(res, 'Product deleted successfully', {});
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Scan product via barcode (POST).
   */
  static async scan(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { barcode } = req.body;
      const product = await ProductService.getByBarcode(barcode);

      if (!product) {
        return next(new ApiError(404, `Product with barcode ${barcode} not found`));
      }

      return ApiResponse.success(res, 'Product scanned successfully', product);
    } catch (error) {
      return next(error);
    }
  }
}
