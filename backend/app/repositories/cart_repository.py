from ..config.database import get_db

class CartRepository:
    @staticmethod
    def add_to_cart(session_id: str, product_id: str, quantity: int) -> dict:
        """
        Add a product to the cart. If it already exists, increment the quantity.
        """
        with get_db() as conn:
            with conn.cursor() as cur:
                # Check for existing cart item
                cur.execute(
                    "SELECT id, quantity FROM cart_items WHERE session_id = %s AND product_id = %s;",
                    (session_id, product_id)
                )
                row = cur.fetchone()
                
                if row:
                    cart_item_id = row[0]
                    new_qty = row[1] + quantity
                    cur.execute(
                        "UPDATE cart_items SET quantity = %s WHERE id = %s "
                        "RETURNING id, product_id, quantity;",
                        (new_qty, cart_item_id)
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO cart_items (session_id, product_id, quantity)
                        VALUES (%s, %s, %s)
                        RETURNING id, product_id, quantity;
                        """,
                        (session_id, product_id, quantity)
                    )
                
                res = cur.fetchone()
                conn.commit()
                return {
                    "cartItemId": str(res[0]),
                    "productId": str(res[1]),
                    "quantity": res[2]
                }

    @staticmethod
    def get_cart_items(session_id: str) -> list:
        """
        Fetch cart items for a session, joined with product details.
        """
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT c.id, c.product_id, c.quantity, p.name, p.price, p.weight, p.image, p.category, p.barcode
                    FROM cart_items c
                    JOIN products p ON c.product_id = p.id
                    WHERE c.session_id = %s;
                    """,
                    (session_id,)
                )
                rows = cur.fetchall()
                items = []
                for row in rows:
                    # Map to the properties expected by React state
                    items.append({
                        "id": str(row[0]), # maps cartItemId to 'id' for React compatibility
                        "productId": str(row[1]),
                        "quantity": row[2],
                        "name": row[3],
                        "price": float(row[4]) if row[4] else 0.0,
                        "size": f"{row[5]} kg" if row[5] else "1 unit",
                        "image": row[6],
                        "category": row[7],
                        "barcode": row[8],
                        "icon": "📦" if row[7] != "Dairy" else "🥛"
                    })
                return items

    @staticmethod
    def update_cart_item(cart_item_id: str, quantity: int) -> dict | None:
        """
        Update the quantity of an item in the cart.
        """
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE cart_items SET quantity = %s WHERE id = %s "
                    "RETURNING id, product_id, quantity;",
                    (quantity, cart_item_id)
                )
                row = cur.fetchone()
                conn.commit()
                if not row:
                    return None
                return {
                    "cartItemId": str(row[0]),
                    "productId": str(row[1]),
                    "quantity": row[2]
                }

    @staticmethod
    def delete_cart_item(cart_item_id: str) -> bool:
        """
        Remove an item from the cart.
        """
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM cart_items WHERE id = %s;", (cart_item_id,))
                row_count = cur.rowcount
                conn.commit()
                return row_count > 0
