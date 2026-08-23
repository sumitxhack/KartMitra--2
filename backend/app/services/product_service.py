from ..repositories.product_repository import ProductRepository
from fastapi import HTTPException

class ProductService:
    @staticmethod
    def get_all_products() -> list:
        """
        List all products in the database.
        """
        return ProductRepository.find_all()

    @staticmethod
    def get_product_by_id(product_id: str) -> dict:
        """
        Fetch a product by ID.
        """
        product = ProductRepository.find_by_id(product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return product

    @staticmethod
    def get_product_by_barcode(barcode: str) -> dict:
        """
        Fetch a product by barcode (used by barcode-scanners).
        """
        product = ProductRepository.find_by_barcode(barcode)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product with barcode {barcode} not found")
        return product

    @staticmethod
    def create_product(data: dict) -> dict:
        """
        Register a new product barcode.
        """
        existing = ProductRepository.find_by_barcode(data["barcode"])
        if existing:
            raise HTTPException(status_code=400, detail=f"Product with barcode {data['barcode']} already exists")
        return ProductRepository.create(data)

    @staticmethod
    def update_product(product_id: str, data: dict) -> dict:
        """
        Update product info.
        """
        product = ProductRepository.update(product_id, data)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return product

    @staticmethod
    def delete_product(product_id: str) -> bool:
        """
        Delete a product.
        """
        deleted = ProductRepository.delete(product_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Product not found")
        return True
