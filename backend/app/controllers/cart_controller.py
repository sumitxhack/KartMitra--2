from ..services.cart_service import CartService
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

class CartController:
    @staticmethod
    def add(session_id: str, product_id: str, quantity: int) -> JSONResponse:
        """
        Add item to cart.
        """
        result = CartService.add_item(session_id, product_id, quantity)
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Product added to cart",
                "data": jsonable_encoder(result)
            }
        )

    @staticmethod
    def get_all(session_id: str) -> JSONResponse:
        """
        Get all items in cart.
        """
        result = CartService.get_items(session_id)
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": jsonable_encoder(result)
            }
        )

    @staticmethod
    def update(cart_item_id: str, quantity: int) -> JSONResponse:
        """
        Update item quantity.
        """
        result = CartService.update_item(cart_item_id, quantity)
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Cart item updated",
                "data": jsonable_encoder(result)
            }
        )

    @staticmethod
    def delete(cart_item_id: str) -> JSONResponse:
        """
        Remove item from cart.
        """
        CartService.delete_item(cart_item_id)
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Cart item deleted"
            }
        )
