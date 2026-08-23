from pydantic import BaseModel

class CartAddRequest(BaseModel):
    sessionId: str
    productId: str
    quantity: int = 1

class CartUpdateRequest(BaseModel):
    quantity: int
