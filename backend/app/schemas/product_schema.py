from pydantic import BaseModel

class ProductCreate(BaseModel):
    barcode: str
    name: str
    price: float
    weight: float | None = None
    image: str | None = None
    category: str | None = None
