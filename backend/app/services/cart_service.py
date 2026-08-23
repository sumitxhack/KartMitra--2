from ..repositories.cart_repository import CartRepository
from fastapi import HTTPException

class CartService:
    @staticmethod
    def add_item(session_id: str, product_id: str, quantity: int) -> dict:
        """
        Add an item to the shopping cart.
        """
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be a positive integer")
        return CartRepository.add_to_cart(session_id, product_id, quantity)

    @staticmethod
    def get_items(session_id: str) -> list:
        """
        List items in the shopping cart for a session.
        """
        if not session_id:
            raise HTTPException(status_code=400, detail="sessionId query parameter is required")
        return CartRepository.get_cart_items(session_id)

    @staticmethod
    def update_item(cart_item_id: str, quantity: int) -> dict:
        """
        Update the quantity of a cart item.
        """
        if quantity <= 0:
            # Fallback to delete if quantity goes to 0 or below
            CartRepository.delete_cart_item(cart_item_id)
            return {"cartItemId": cart_item_id, "quantity": 0, "deleted": True}

        updated = CartRepository.update_cart_item(cart_item_id, quantity)
        if not updated:
            raise HTTPException(status_code=404, detail="Cart item not found")
        return updated

    @staticmethod
    def delete_item(cart_item_id: str) -> bool:
        """
        Delete an item from the cart.
        """
        deleted = CartRepository.delete_cart_item(cart_item_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Cart item not found")
        return True
