import os
import uuid
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import numpy as np
import cv2
import zxingcpp

from db import (
    get_product_by_barcode,
    get_product_by_id,
    get_all_products,
    create_product,
    get_product_images,
    save_product_image,
    get_product_image_by_id,
    delete_product_image,
    get_dataset_statistics,
)
from image_service import (
    validate_image_bytes,
    compute_image_hashes,
    check_duplicate,
    process_and_save_image,
    delete_image_files,
    ensure_upload_dirs,
)

app = FastAPI(
    title="KartMitra AI Verification Lab API",
    version="1.1.0",
    description="Barcode Recognition & Product Image Dataset Management System",
)

# Configure CORS for Next.js access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploaded media directory for serving images & thumbnails
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Pydantic Schemas
class ProductCreateRequest(BaseModel):
    barcode: str = Field(..., min_length=1, description="Product barcode value")
    name: str = Field(..., min_length=1, description="Product name")
    price: int = Field(..., ge=0, description="Price in INR")
    weight: float = Field(..., gt=0, description="Weight in kg")
    category: str = Field(..., min_length=1, description="Product category")


# ==========================================
# BARCODE RECOGNITION ROUTE
# ==========================================
@app.post("/api/v1/recognition/barcode")
async def recognize_barcode(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"success": False, "error": "Invalid image file format"}

        results = zxingcpp.read_barcodes(img)

        if not results:
            return {"success": False, "error": "Barcode not detected"}

        barcode_value = results[0].text
        if not barcode_value or barcode_value.strip() == "":
            return {"success": False, "error": "Invalid barcode"}

        product = get_product_by_barcode(barcode_value)

        if product:
            return {
                "success": True,
                "barcode": barcode_value,
                "found": True,
                "product": {
                    "id": product["id"],
                    "barcode": product["barcode"],
                    "name": product["name"],
                    "price": product["price"],
                    "weight": product["weight"],
                    "category": product["category"],
                },
            }
        else:
            return {
                "success": True,
                "barcode": barcode_value,
                "found": False,
            }
    except Exception as e:
        print(f"Error occurred in barcode API: {e}", flush=True)
        return {"success": False, "error": "API failure"}


# ==========================================
# PRODUCT MANAGEMENT ROUTES
# ==========================================
@app.get("/api/v1/products")
def list_products():
    """List all registered products with training image counts and status flags."""
    products = get_all_products()
    return {"success": True, "products": products}


@app.post("/api/v1/products")
def register_product(payload: ProductCreateRequest):
    """Register a new product in the database."""
    # Check if barcode already exists
    existing = get_product_by_barcode(payload.barcode)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Product with barcode '{payload.barcode}' already exists: {existing['name']}",
        )

    product_id = str(uuid.uuid4())
    new_product = create_product(
        product_id=product_id,
        barcode=payload.barcode,
        name=payload.name,
        price=payload.price,
        weight=payload.weight,
        category=payload.category,
    )

    if not new_product:
        raise HTTPException(status_code=500, detail="Failed to register product")

    # Add default image count fields for response consistency
    new_product["image_count"] = 0
    new_product["needs_more_images"] = True

    return {"success": True, "product": new_product}


@app.get("/api/v1/products/{product_id}")
def get_product_details(product_id: str):
    """Get single product details."""
    product = get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    images = get_product_images(product_id)
    product["image_count"] = len(images)
    product["needs_more_images"] = len(images) < 5

    return {"success": True, "product": product, "images": images}


# ==========================================
# PRODUCT IMAGE DATASET ROUTES
# ==========================================
@app.get("/api/v1/products/{product_id}/images")
def list_product_images(product_id: str):
    """List all training images stored for a product."""
    product = get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    images = get_product_images(product_id)
    return {
        "success": True,
        "product_id": product_id,
        "image_count": len(images),
        "needs_more_images": len(images) < 5,
        "images": images,
    }


@app.post("/api/v1/products/{product_id}/images/upload")
async def upload_product_image(
    product_id: str,
    file: UploadFile = File(...),
    image_type: str = Form("front"),
):
    """
    Upload or capture a training image for a product.
    Includes validation, duplicate detection, resizing, normalization, and thumbnail generation.
    """
    # 1. Verify product exists
    product = get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # 2. Read image bytes & Validate format / corruption
    image_bytes = await file.read()
    is_valid, err_msg, img_obj = validate_image_bytes(image_bytes)
    if not is_valid or img_obj is None:
        return {
            "success": False,
            "error": err_msg or "Invalid or corrupt image file",
        }

    # 3. Compute Hashes & Check for Duplicate Images
    md5_hash, dhash = compute_image_hashes(image_bytes, img_obj)
    existing_images = get_product_images(product_id)
    is_dup, dup_msg = check_duplicate(md5_hash, dhash, existing_images)
    if is_dup:
        return {
            "success": False,
            "error": f"Duplicate image rejected: {dup_msg}",
            "is_duplicate": True,
        }

    # 4. Process (Resize, Normalize, Thumbnail) & Save to disk
    image_id = str(uuid.uuid4())
    img_path, thumb_path, width, height, file_size = process_and_save_image(
        img_obj, product_id, image_id
    )

    # 5. Save Metadata Record to PostgreSQL
    # Store dhash prefix + md5 in file_hash column for future perceptual checks
    combined_hash = f"{dhash}:{md5_hash}"
    saved_record = save_product_image(
        image_id=image_id,
        product_id=product_id,
        image_path=img_path,
        thumbnail_path=thumb_path,
        image_type=image_type.strip().lower(),
        width=width,
        height=height,
        file_size=file_size,
        file_hash=combined_hash,
    )

    if not saved_record:
        # Clean up files if database save failed
        delete_image_files(img_path, thumb_path)
        return {"success": False, "error": "Database error while saving image metadata"}

    updated_images = get_product_images(product_id)

    return {
        "success": True,
        "message": "Image validated, processed, and saved successfully.",
        "image": saved_record,
        "total_images": len(updated_images),
        "needs_more_images": len(updated_images) < 5,
    }


@app.delete("/api/v1/products/{product_id}/images/{image_id}")
def remove_product_image(product_id: str, image_id: str):
    """Delete a training image and its thumbnail."""
    image_record = get_product_image_by_id(image_id)
    if not image_record or image_record["product_id"] != product_id:
        raise HTTPException(status_code=404, detail="Image record not found")

    # Delete record from database
    deleted = delete_product_image(image_id, product_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete image record")

    # Delete files from disk
    delete_image_files(
        image_record["image_path"], image_record["thumbnail_path"]
    )

    updated_images = get_product_images(product_id)

    return {
        "success": True,
        "message": "Image deleted successfully",
        "total_images": len(updated_images),
        "needs_more_images": len(updated_images) < 5,
    }


# ==========================================
# DATASET STATISTICS ROUTES
# ==========================================
@app.get("/api/v1/dataset/stats")
def dataset_stats():
    """Retrieve aggregate statistics and product image coverage metrics."""
    stats = get_dataset_statistics()
    return {"success": True, "stats": stats}


@app.get("/health")
def health_check():
    return {"status": "ok"}
