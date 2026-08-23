import { ProductRepository } from '../repositories/product.repository';

export interface Product {
  id: string;
  barcode: string;
  name: string;
  price: number;
  weight?: number;
  image?: string;
  category?: string;
  createdAt: string;

  // Optional fields kept for legacy frontend compatibility
  sku?: string;
  cost?: number;
  stock?: number;
  supplierId?: string;
}

export class ProductService {
  /**
   * Fetch all products.
   */
  static async getAll(): Promise<Product[]> {
    return ProductRepository.findAll();
  }

  /**
   * Fetch product by ID.
   */
  static async getById(id: string): Promise<Product | null> {
    return ProductRepository.findById(id);
  }

  /**
   * Fetch product by barcode.
   */
  static async getByBarcode(barcode: string): Promise<Product | null> {
    return ProductRepository.findByBarcode(barcode);
  }

  /**
   * Insert product.
   */
  static async create(data: Partial<Product>): Promise<Product> {
    return ProductRepository.create(data);
  }

  /**
   * Update product details.
   */
  static async update(id: string, data: Partial<Product>): Promise<Product | null> {
    return ProductRepository.update(id, data);
  }

  /**
   * Remove a product.
   */
  static async delete(id: string): Promise<boolean> {
    return ProductRepository.delete(id);
  }
}
