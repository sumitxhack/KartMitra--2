import psycopg
from psycopg.rows import dict_row

DB_CONN_STRING = "postgresql://postgres@127.0.0.1:5432/kartmitra"

def get_db_connection():
    return psycopg.connect(DB_CONN_STRING, row_factory=dict_row, autocommit=True)

def get_product_by_barcode(barcode: str):
    """Queries PostgreSQL for a product with the specified barcode."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, barcode, name, price, weight, category FROM products WHERE barcode = %s",
                    (barcode,)
                )
                return cur.fetchone()
    except Exception as e:
        print(f"Database query error: {e}", flush=True)
        return None

def get_product_by_id(product_id: str):
    """Queries PostgreSQL for a product with the specified ID."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, barcode, name, price, weight, category FROM products WHERE id = %s",
                    (product_id,)
                )
                return cur.fetchone()
    except Exception as e:
        print(f"Database query error: {e}", flush=True)
        return None

def get_all_products():
    """
    Returns list of all products with their current training image count and flag status (<5 images).
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT p.id, p.barcode, p.name, p.price, p.weight, p.category,
                           COUNT(pi.id) as image_count,
                           (COUNT(pi.id) < 5) as needs_more_images
                    FROM products p
                    LEFT JOIN product_images pi ON p.id = pi.product_id
                    GROUP BY p.id, p.barcode, p.name, p.price, p.weight, p.category
                    ORDER BY p.name ASC
                """)
                return cur.fetchall()
    except Exception as e:
        print(f"Database query error: {e}", flush=True)
        return []

def create_product(product_id: str, barcode: str, name: str, price: int, weight: float, category: str):
    """Registers a new product in the database."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO products (id, barcode, name, price, weight, category)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, barcode, name, price, weight, category
                """, (product_id, barcode, name, price, weight, category))
                return cur.fetchone()
    except Exception as e:
        print(f"Database insert error: {e}", flush=True)
        return None

def get_product_images(product_id: str):
    """Retrieves all image metadata records for a product."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, product_id, image_path, thumbnail_path, image_type,
                           width, height, file_size, file_hash, created_at
                    FROM product_images
                    WHERE product_id = %s
                    ORDER BY created_at DESC
                """, (product_id,))
                return cur.fetchall()
    except Exception as e:
        print(f"Database query error: {e}", flush=True)
        return []

def save_product_image(
    image_id: str,
    product_id: str,
    image_path: str,
    thumbnail_path: str,
    image_type: str,
    width: int,
    height: int,
    file_size: int,
    file_hash: str
):
    """Inserts a new product image record into the database."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO product_images (
                        id, product_id, image_path, thumbnail_path, image_type,
                        width, height, file_size, file_hash
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, product_id, image_path, thumbnail_path, image_type,
                              width, height, file_size, file_hash, created_at
                """, (
                    image_id, product_id, image_path, thumbnail_path, image_type,
                    width, height, file_size, file_hash
                ))
                return cur.fetchone()
    except Exception as e:
        print(f"Database image insert error: {e}", flush=True)
        return None

def get_product_image_by_id(image_id: str):
    """Retrieves single image metadata by ID."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, product_id, image_path, thumbnail_path, image_type,
                           width, height, file_size, file_hash, created_at
                    FROM product_images
                    WHERE id = %s
                """, (image_id,))
                return cur.fetchone()
    except Exception as e:
        print(f"Database query error: {e}", flush=True)
        return None

def delete_product_image(image_id: str, product_id: str):
    """Deletes an image record from the database."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM product_images
                    WHERE id = %s AND product_id = %s
                    RETURNING id
                """, (image_id, product_id))
                return cur.fetchone() is not None
    except Exception as e:
        print(f"Database delete error: {e}", flush=True)
        return False

def get_dataset_statistics():
    """
    Computes dataset statistics:
    - Total Products
    - Total Images
    - Images Per Product (Average)
    - Products Without Enough Images (< 5)
    - Detailed per-product image counts and variation types.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Summary statistics query
                cur.execute("""
                    SELECT 
                        COUNT(p.id) as total_products,
                        COALESCE(SUM(img_cnt.count), 0) as total_images,
                        COALESCE(ROUND(AVG(COALESCE(img_cnt.count, 0))::numeric, 2), 0) as avg_images_per_product,
                        COUNT(p.id) FILTER (WHERE COALESCE(img_cnt.count, 0) < 5) as products_without_enough_images
                    FROM products p
                    LEFT JOIN (
                        SELECT product_id, COUNT(id) as count
                        FROM product_images
                        GROUP BY product_id
                    ) img_cnt ON p.id = img_cnt.product_id
                """)
                summary = cur.fetchone()

                # Detailed product stats query
                cur.execute("""
                    SELECT 
                        p.id,
                        p.barcode,
                        p.name,
                        p.category,
                        COUNT(pi.id) as total_images,
                        (COUNT(pi.id) < 5) as needs_more_images,
                        ARRAY_REMOVE(ARRAY_AGG(DISTINCT pi.image_type), NULL) as image_types
                    FROM products p
                    LEFT JOIN product_images pi ON p.id = pi.product_id
                    GROUP BY p.id, p.barcode, p.name, p.category
                    ORDER BY needs_more_images DESC, total_images ASC, p.name ASC
                """)
                products_detail = cur.fetchall()

                return {
                    "total_products": summary["total_products"] if summary else 0,
                    "total_images": summary["total_images"] if summary else 0,
                    "avg_images_per_product": float(summary["avg_images_per_product"]) if summary else 0.0,
                    "products_without_enough_images": summary["products_without_enough_images"] if summary else 0,
                    "products": products_detail
                }
    except Exception as e:
        print(f"Database statistics error: {e}", flush=True)
        return {
            "total_products": 0,
            "total_images": 0,
            "avg_images_per_product": 0.0,
            "products_without_enough_images": 0,
            "products": []
        }
