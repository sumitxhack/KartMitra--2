import { pool } from '../config/database';
import { Product } from '../services/product.service';

export class ProductRepository {
  /**
   * Fetch all products from PostgreSQL database.
   */
  static async findAll(): Promise<Product[]> {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    return rows.map(this.mapRowToProduct);
  }

  /**
   * Fetch a single product by UUID.
   */
  static async findById(id: string): Promise<Product | null> {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (rows.length === 0) return null;
    return this.mapRowToProduct(rows[0]);
  }

  /**
   * Fetch a single product by Barcode.
   */
  static async findByBarcode(barcode: string): Promise<Product | null> {
    const { rows } = await pool.query('SELECT * FROM products WHERE barcode = $1', [barcode]);
    if (rows.length === 0) return null;
    return this.mapRowToProduct(rows[0]);
  }

  /**
   * Insert a new product into PostgreSQL.
   */
  static async create(data: Partial<Product>): Promise<Product> {
    const { barcode, name, price, weight, image, category } = data;
    const query = `
      INSERT INTO products (barcode, name, price, weight, image, category)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      barcode,
      name,
      price,
      weight ?? null,
      image ?? null,
      category ?? null
    ];
    const { rows } = await pool.query(query, values);
    return this.mapRowToProduct(rows[0]);
  }

  /**
   * Update a product by UUID.
   */
  static async update(id: string, data: Partial<Product>): Promise<Product | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let queryIndex = 1;

    const updatableFields = ['barcode', 'name', 'price', 'weight', 'image', 'category'];
    for (const [key, val] of Object.entries(data)) {
      if (updatableFields.includes(key)) {
        fields.push(`${key} = $${queryIndex}`);
        values.push(val);
        queryIndex++;
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE products
      SET ${fields.join(', ')}
      WHERE id = $${queryIndex}
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) return null;
    return this.mapRowToProduct(rows[0]);
  }

  /**
   * Delete a product by UUID.
   */
  static async delete(id: string): Promise<boolean> {
    const { rowCount } = await pool.query('DELETE FROM products WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  /**
   * Helper to map raw database row results to Product object.
   */
  private static mapRowToProduct(row: any): Product {
    return {
      id: row.id,
      barcode: row.barcode,
      name: row.name,
      price: typeof row.price === 'string' ? parseFloat(row.price) : row.price,
      weight: row.weight ? (typeof row.weight === 'string' ? parseFloat(row.weight) : row.weight) : undefined,
      image: row.image || undefined,
      category: row.category || undefined,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
      
      // Compatibility layers with previous mock models
      sku: row.barcode,
      cost: typeof row.price === 'string' ? parseFloat(row.price) * 0.7 : row.price * 0.7,
      stock: 100,
      supplierId: 'sup-1'
    };
  }
}
