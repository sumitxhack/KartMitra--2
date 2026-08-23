from fastapi import APIRouter, Depends, Query
from ..schemas.cart_schema import CartAddRequest, CartUpdateRequest
from ..controllers.cart_controller import CartController
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/cart", tags=["cart"])

@router.post("/add")
def add_to_cart(payload: CartAddRequest, current_user: dict = Depends(get_current_user)):
    """
    Add a product item to the shopping cart.
    """
    return CartController.add(payload.sessionId, payload.productId, payload.quantity)

@router.get("")
def get_cart_items(sessionId: str = Query(..., description="The active shopping session UUID"), current_user: dict = Depends(get_current_user)):
    """
    List all products in the active shopping session.
    """
    return CartController.get_all(sessionId)

@router.put("/{cartItemId}")
def update_cart_item(cartItemId: str, payload: CartUpdateRequest, current_user: dict = Depends(get_current_user)):
    """
    Modify quantity of a product in the cart.
    """
    return CartController.update(cartItemId, payload.quantity)

@router.delete("/{cartItemId}")
def delete_cart_item(cartItemId: str, current_user: dict = Depends(get_current_user)):
    """
    Remove an item from the cart.
    """
    return CartController.delete(cartItemId)
