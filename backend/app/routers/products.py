from fastapi import APIRouter
from ..controllers.product_controller import ProductController
from ..schemas.product_schema import ProductCreate

router = APIRouter(prefix="/products", tags=["products"])

@router.get("")
def get_all_products():
    """
    Get all products.
    """
    return ProductController.get_all()

@router.get("/barcode/{barcode}")
def get_product_by_barcode_explicit(barcode: str):
    """
    Get a single product by barcode (explicit endpoint).
    """
    return ProductController.get_by_barcode(barcode)

@router.get("/{param}")
def get_product_by_identifier(param: str):
    """
    Dynamic routing that resolves both UUID keys and numeric Barcodes.
    """
    # A standard UUID contains hyphens and is 36 characters long.
    # A barcode is a string of numbers (typically 8, 12, or 13 digits).
    if len(param) == 36 and "-" in param:
        return ProductController.get_by_id(param)
    else:
        return ProductController.get_by_barcode(param)

@router.post("")
def create_product(payload: ProductCreate):
    """
    Register a new product.
    """
    return ProductController.create(payload.model_dump())

@router.put("/{product_id}")
def update_product(product_id: str, payload: ProductCreate):
    """
    Update product details.
    """
    return ProductController.update(product_id, payload.model_dump())

@router.delete("/{product_id}")
def delete_product(product_id: str):
    """
    Delete a product.
    """
    return ProductController.delete(product_id)
