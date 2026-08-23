from ..config.database import get_db

class ProductRepository:
    @staticmethod
    def find_all() -> list:
        """
        Fetch all products from PostgreSQL.
        """
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, barcode, name, price, weight, image, category, created_at "
                    "FROM products ORDER BY created_at DESC;"
                )
                columns = [col[0] for col in cur.description]
                rows = cur.fetchall()
                return [dict(zip(columns, row)) for row in rows]

    @staticmethod
    def find_by_id(product_id: str) -> dict | None:
        """
        Fetch a product by UUID.
        """
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, barcode, name, price, weight, image, category, created_at "
                    "FROM products WHERE id = %s;",
                    (product_id,)
                )
                columns = [col[0] for col in cur.description]
                row = cur.fetchone()
                if not row:
                    return None
                return dict(zip(columns, row))

    @staticmethod
    def find_by_barcode(barcode: str) -> dict | None:
        """
        Fetch a product by barcode.
        """
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, barcode, name, price, weight, image, category, created_at "
                    "FROM products WHERE barcode = %s;",
                    (barcode,)
                )
                columns = [col[0] for col in cur.description]
                row = cur.fetchone()
                if not row:
                    return None
                return dict(zip(columns, row))

    @staticmethod
    def create(data: dict) -> dict:
        """
        Insert a new product into PostgreSQL.
        """
        barcode = data["barcode"]
        name = data["name"]
        price = data["price"]
        weight = data.get("weight")
        image = data.get("image")
        category = data.get("category")

        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO products (barcode, name, price, weight, image, category)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, barcode, name, price, weight, image, category, created_at;
                    """,
                    (barcode, name, price, weight, image, category)
                )
                columns = [col[0] for col in cur.description]
                row = cur.fetchone()
                conn.commit()
                return dict(zip(columns, row))

    @staticmethod
    def update(product_id: str, data: dict) -> dict | None:
        """
        Update an existing product.
        """
        fields = []
        values = []
        updatable = ["barcode", "name", "price", "weight", "image", "category"]
        for key in updatable:
            if key in data and data[key] is not None:
                fields.append(f"{key} = %s")
                values.append(data[key])
        
        if not fields:
            return ProductRepository.find_by_id(product_id)

        values.append(product_id)
        query = (
            f"UPDATE products SET {', '.join(fields)} WHERE id = %s "
            f"RETURNING id, barcode, name, price, weight, image, category, created_at;"
        )
        
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(query, values)
                columns = [col[0] for col in cur.description]
                row = cur.fetchone()
                conn.commit()
                if not row:
                    return None
                return dict(zip(columns, row))

    @staticmethod
    def delete(product_id: str) -> bool:
        """
        Delete a product.
        """
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM products WHERE id = %s;", (product_id,))
                row_count = cur.rowcount
                conn.commit()
                return row_count > 0
