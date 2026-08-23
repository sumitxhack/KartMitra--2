from ..services.product_service import ProductService
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

class ProductController:
    @staticmethod
    def get_all() -> JSONResponse:
        """
        Get all products.
        """
        products = ProductService.get_all_products()
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": jsonable_encoder(products)
            }
        )

    @staticmethod
    def get_by_id(product_id: str) -> JSONResponse:
        """
        Get product by UUID.
        """
        product = ProductService.get_product_by_id(product_id)
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": jsonable_encoder(product)
            }
        )

    @staticmethod
    def get_by_barcode(barcode: str) -> JSONResponse:
        """
        Get product by barcode (used by scanner).
        """
        product = ProductService.get_product_by_barcode(barcode)
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": jsonable_encoder(product)
            }
        )

    @staticmethod
    def create(data: dict) -> JSONResponse:
        """
        Create a new product.
        """
        product = ProductService.create_product(data)
        return JSONResponse(
            status_code=201,
            content={
                "success": True,
                "message": "Product created successfully",
                "data": jsonable_encoder(product)
            }
        )

    @staticmethod
    def update(product_id: str, data: dict) -> JSONResponse:
        """
        Update an existing product.
        """
        product = ProductService.update_product(product_id, data)
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Product updated successfully",
                "data": jsonable_encoder(product)
            }
        )

    @staticmethod
    def delete(product_id: str) -> JSONResponse:
        """
        Delete a product.
        """
        ProductService.delete_product(product_id)
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Product deleted successfully"
            }
        )
