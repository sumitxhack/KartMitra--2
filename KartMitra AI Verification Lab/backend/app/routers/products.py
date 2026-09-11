import shutil
import uuid
import sys
from typing import List, Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse

from sqlalchemy.orm import Session

# Add parent directory to sys.path to allow importing backend modules like image_service
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from image_service import (
    validate_image_bytes,
    compute_image_hashes,
    check_duplicate,
    process_and_save_image,
    delete_image_files,
)

from app import crud, schemas, config
from app.db import get_db

router = APIRouter(prefix="/products", tags=["products"])

@router.post("", response_model=schemas.ProductResponse, status_code=status.HTTP_200_OK)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    # Validate barcode uniqueness
    db_product = crud.get_product_by_barcode(db, barcode=product.barcode)
    if db_product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Barcode '{product.barcode}' is already registered."
        )
    created = crud.create_product(db=db, product=product)
    
    # Ensure needs_more_images is returned for response consistency
    # (Since it's a new product with 0 images, image_count=0, needs_more_images=True)
    product_dict = {
        "id": created.id,
        "barcode": created.barcode,
        "name": created.name,
        "price": created.price,
        "weight": created.weight,
        "category": created.category,
        "description": created.description,
        "created_at": created.created_at,
        "updated_at": created.updated_at,
        "indexing_status": created.indexing_status or "PENDING",
        "indexing_error": created.indexing_error,
        "image_count": 0,
        "needs_more_images": True,
        "images": []
    }
    
    return {"success": True, "product": product_dict}

@router.get("", response_model=schemas.ProductsResponse)
def read_products(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    products = crud.get_products(db, skip=skip, limit=limit, search=search)
    return {"success": True, "products": products}

@router.get("/barcode/{barcode}", response_model=schemas.ProductResponse)
def read_product_by_barcode(barcode: str, db: Session = Depends(get_db)):
    db_product = crud.get_product_by_barcode(db, barcode=barcode)
    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with barcode '{barcode}' not found."
        )
    return {"success": True, "product": db_product}

@router.get("/{id}", response_model=schemas.ProductResponse)
def read_product(id: str, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id=id)
    if not db_product:
        # Fallback: check if id is barcode
        db_product = crud.get_product_by_barcode(db, barcode=id)
    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID or barcode '{id}' not found."
        )
    return {"success": True, "product": db_product}

@router.put("/{id}", response_model=schemas.ProductResponse)
def update_product(id: str, product_update: schemas.ProductUpdate, db: Session = Depends(get_db)):
    # Check existence
    db_product = crud.get_product(db, product_id=id)
    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {id} not found."
        )
    
    # If barcode is being updated, check for conflict
    if product_update.barcode and product_update.barcode != db_product.barcode:
        barcode_conflict = crud.get_product_by_barcode(db, barcode=product_update.barcode)
        if barcode_conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Barcode '{product_update.barcode}' is already in use by another product."
            )
            
    updated = crud.update_product(db=db, product_id=id, product_update=product_update)
    return {"success": True, "product": updated}

@router.delete("/{id}", response_model=schemas.SuccessResponse, status_code=status.HTTP_200_OK)
def delete_product(id: str, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id=id)
    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {id} not found."
        )
    
    # Physically delete all image files of this product
    for img in db_product.images:
        try:
            delete_image_files(img.image_path, img.thumbnail_path)
        except Exception as e:
            print(f"Error deleting physical file {img.image_path}: {e}")

    # Remove all visual embeddings from FAISS index and DB
    if config.ENABLE_VISUAL_MATCHING:
        try:
            from app.visual_registry_service import remove_product_from_index
            remove_product_from_index(id, db)
        except Exception as ve_err:
            print(f"[Product Delete] Visual index cleanup warning: {ve_err}", flush=True)

    # Delete from DB (CASCADE will delete image db rows)
    crud.delete_product(db=db, product_id=id)
    return {"success": True}

# --- Product Images Endpoints ---

@router.post("/{id}/images", response_model=schemas.ProductImageResponse, status_code=status.HTTP_200_OK)
@router.post("/{id}/images/upload", response_model=schemas.ProductImageResponse, status_code=status.HTTP_200_OK)
@router.post("/{id}/reference-images", response_model=schemas.ProductImageResponse, status_code=status.HTTP_200_OK)
@router.post("/{id}/reference-images/upload", response_model=schemas.ProductImageResponse, status_code=status.HTTP_200_OK)
async def upload_product_image(
    id: str,
    image_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Verify product exists
    db_product = crud.get_product(db, product_id=id)
    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {id} not found."
        )
    
    # Validate image_type
    image_type = image_type.lower().strip()
    if not image_type:
        image_type = "additional"
    elif len(image_type) > 50:
        image_type = image_type[:50]
        
    # Validate file extension
    file_path_obj = Path(file.filename)
    extension = file_path_obj.suffix.lower()
    if extension not in config.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{extension}'. Supported formats: {list(config.ALLOWED_EXTENSIONS)}"
        )
        
    # Validate file size
    content_size = 0
    try:
        await file.seek(0, 2)  # seek to end
        content_size = await file.tell()
        await file.seek(0)  # reset cursor
    except Exception:
        content_length = file.headers.get("content-length")
        if content_length:
            content_size = int(content_length)
            
    if content_size > config.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File is too large ({content_size / (1024 * 1024):.2f} MB). Maximum size allowed is {config.MAX_FILE_SIZE / (1024 * 1024):.0f} MB."
        )
        
    # Read image bytes
    try:
        image_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read uploaded file: {str(e)}"
        )

    # Validate image format/corruption via cv2
    is_valid, err_msg, img_obj = validate_image_bytes(image_bytes)
    if not is_valid or img_obj is None:
        return {
            "success": False,
            "error": err_msg or "Invalid or corrupt image file"
        }
        
    # Compute perceptual hashes and check duplicate image submission
    md5_hash, dhash = compute_image_hashes(image_bytes, img_obj)
    existing_images = []
    for img in db_product.images:
        existing_images.append({
            "id": img.id,
            "image_path": img.image_path,
            "thumbnail_path": img.thumbnail_path,
            "file_hash": img.file_hash
        })
        
    is_dup, dup_msg = check_duplicate(md5_hash, dhash, existing_images)
    if is_dup:
        return {
            "success": False,
            "error": f"Duplicate image rejected: {dup_msg}",
            "is_duplicate": True
        }
        
    # Process image (resize to standard max density, generate thumbnail, save files)
    image_id = str(uuid.uuid4())
    try:
        img_path, thumb_path, width, height, file_size = process_and_save_image(
            img_obj, id, image_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Image processing failed: {str(e)}"
        )
        
    # Save Metadata to DB
    combined_hash = f"{dhash}:{md5_hash}"
    try:
        created_img = crud.create_product_image(
            db=db,
            product_id=id,
            image_path=img_path,
            image_type=image_type,
            thumbnail_path=thumb_path,
            width=width,
            height=height,
            file_size=file_size,
            file_hash=combined_hash
        )
    except Exception as e:
        # Clean up physical files if DB registration fails
        delete_image_files(img_path, thumb_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record image metadata: {str(e)}"
        )
        
    # Automatic Visual Embedding Index Update (Prompt 5 & Step 13E)
    if config.ENABLE_VISUAL_MATCHING:
        try:
            from app.feature_matcher import resolve_image_path
            from app.visual_embedding_service import generate_real_embedding_from_path, require_real_dinov2_model
            from app import visual_index_service
            
            require_real_dinov2_model()
            abs_file_path = resolve_image_path(created_img.image_path)
            if abs_file_path and abs_file_path.exists():
                emb_vec = generate_real_embedding_from_path(abs_file_path)
                faiss_id = visual_index_service.add_embedding(
                    vector=emb_vec,
                    product_id=id,
                    product_image_id=created_img.id,
                    image_path=created_img.image_path,
                    model_name=config.VISUAL_EMBEDDING_MODEL
                )
                crud.create_product_image_embedding(
                    db=db,
                    product_id=id,
                    product_image_id=created_img.id,
                    faiss_index_id=faiss_id,
                    embedding_path=created_img.image_path,
                    model_name=config.VISUAL_EMBEDDING_MODEL,
                    embedding_dimension=len(emb_vec)
                )
                crud.update_product_indexing_status(db, id, "READY", None)
        except Exception as ve_err:
            print(f"[Product Image Upload] Visual embedding error: {ve_err}", flush=True)
            crud.update_product_indexing_status(db, id, "FAILED", str(ve_err))

    updated_images = db_product.images # Fetch current list (includes new image)
    total_imgs = len(updated_images)
    
    return {
        "success": True, 
        "message": "Image validated, processed, and saved successfully.",
        "image": created_img,
        "total_images": total_imgs,
        "needs_more_images": total_imgs < 5
    }

@router.get("/{id}/images", response_model=schemas.ProductImagesResponse)
def read_product_images(id: str, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id=id)
    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {id} not found."
        )
    
    images = db_product.images
    return {
        "success": True,
        "images": images,
        "image_count": len(images),
        "needs_more_images": len(images) < 5
    }

@router.delete("/{id}/images/{image_id}", response_model=schemas.DeleteImageResponse, status_code=status.HTTP_200_OK)
def delete_product_image(id: str, image_id: str, db: Session = Depends(get_db)):
    # Verify product exists
    db_product = crud.get_product(db, product_id=id)
    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {id} not found."
        )
        
    # Verify image exists and belongs to this product
    db_image = crud.get_product_image(db, image_id=image_id)
    if not db_image or db_image.product_id != id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image with ID {image_id} not found for product {id}."
        )
        
    # Delete physical files
    try:
        delete_image_files(db_image.image_path, db_image.thumbnail_path)
    except Exception as e:
        print(f"Error deleting physical file {db_image.image_path}: {e}")
        
    # Delete DB record
    crud.delete_product_image(db=db, image_id=image_id)

    # Automatic Visual Embedding Cleanup (Prompt 5 & Step 13P)
    if config.ENABLE_VISUAL_MATCHING:
        try:
            from app.visual_registry_service import remove_image_from_index
            remove_image_from_index(image_id, db)
        except Exception as ve_err:
            print(f"[Product Image Delete] Visual embedding cleanup warning: {ve_err}", flush=True)

    remaining_count = len(db_product.images)
    if remaining_count == 0:
        crud.update_product_indexing_status(db, id, "PENDING", None)
    else:
        crud.update_product_indexing_status(db, id, "READY", None)
    
    return {
        "success": True,
        "message": "Image deleted successfully",
        "total_images": remaining_count,
        "needs_more_images": remaining_count < 5
    }


@router.get("/images/{image_id}/file")
def get_product_image_file(image_id: str, db: Session = Depends(get_db)):
    """Serves physical image file for a given ProductImage ID, resolving relative or local absolute paths."""
    db_image = crud.get_product_image(db, image_id=image_id)
    if not db_image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Image record '{image_id}' not found.")

    from app.feature_matcher import resolve_image_path
    abs_path = resolve_image_path(db_image.image_path)
    if not abs_path or not abs_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Physical image file not found on disk.")

    return FileResponse(str(abs_path))


@router.post("/{id}/ocr-data", response_model=schemas.ProductResponse)
def update_product_ocr_data(
    id: str,
    payload: schemas.OCRDataUpdateRequest,
    db: Session = Depends(get_db)
):
    """Updates packaging keywords and reference OCR text for a registered product."""
    db_product = crud.get_product(db, product_id=id)
    if not db_product:
        db_product = crud.get_product_by_barcode(db, barcode=id)
    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product '{id}' not found."
        )

    updated = crud.update_product_ocr_data(
        db=db,
        product_id=db_product.id,
        keywords=payload.keywords,
        ocr_text=payload.ocr_text
    )
    return {"success": True, "product": updated}


# --- Automatic Dynamic AI Visual Indexing Endpoints (Prompt 5) ---

@router.post("/{id}/images/batch", response_model=schemas.BatchImageUploadResponse, status_code=status.HTTP_200_OK)
@router.post("/{id}/reference-images/batch", response_model=schemas.BatchImageUploadResponse, status_code=status.HTTP_200_OK)
async def upload_product_images_batch(
    id: str,
    files: List[UploadFile] = File(...),
    image_type: str = Form("additional"),
    db: Session = Depends(get_db)
):
    """
    Batch uploads multiple reference images for a product and automatically indexes them into FAISS using DINOv2.
    """
    db_product = crud.get_product(db, product_id=id)
    if not db_product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product '{id}' not found.")

    uploaded_images = []
    errors = []

    # Get existing image hashes to prevent duplicates
    existing_records = [
        {"id": img.id, "image_path": img.image_path, "file_hash": img.file_hash}
        for img in db_product.images
    ]

    for file in files:
        # Validate format
        file_path_obj = Path(file.filename)
        ext = file_path_obj.suffix.lower()
        if ext not in config.ALLOWED_EXTENSIONS:
            errors.append(f"{file.filename}: Unsupported file format '{ext}'")
            continue

        # Read content
        try:
            content = await file.read()
        except Exception as e:
            errors.append(f"{file.filename}: Could not read bytes ({str(e)})")
            continue

        if len(content) > config.MAX_FILE_SIZE:
            errors.append(f"{file.filename}: File exceeds maximum size allowed (5 MB)")
            continue

        # Validate image corruption
        is_valid, err_msg, img_obj = validate_image_bytes(content)
        if not is_valid or img_obj is None:
            errors.append(f"{file.filename}: {err_msg or 'Corrupted image'}")
            continue

        # Perceptual hash duplicate check
        md5_hash, dhash = compute_image_hashes(content, img_obj)
        is_dup, dup_msg = check_duplicate(md5_hash, dhash, existing_records)
        if is_dup:
            errors.append(f"{file.filename}: Duplicate rejected ({dup_msg})")
            continue

        # Process and save
        image_id = str(uuid.uuid4())
        try:
            img_path, thumb_path, width, height, file_size = process_and_save_image(
                img_obj, id, image_id
            )
            combined_hash = f"{dhash}:{md5_hash}"
            created_img = crud.create_product_image(
                db=db,
                product_id=id,
                image_path=img_path,
                image_type=image_type,
                thumbnail_path=thumb_path,
                width=width,
                height=height,
                file_size=file_size,
                file_hash=combined_hash
            )
            uploaded_images.append(created_img)
            existing_records.append({"id": created_img.id, "image_path": img_path, "file_hash": combined_hash})
        except Exception as e:
            errors.append(f"{file.filename}: Failed to process image ({str(e)})")

    # Automatically index newly uploaded images
    from app.visual_registry_service import index_product_images
    idx_status = "PENDING"
    try:
        if uploaded_images or db_product.images:
            idx_res = index_product_images(id, db)
            idx_status = idx_res.get("status", "READY")
    except Exception as idx_err:
        print(f"[Batch Upload] Auto-indexing warning: {idx_err}", flush=True)
        idx_status = "FAILED"

    total_images = len(db_product.images)
    return {
        "success": len(uploaded_images) > 0,
        "product_id": id,
        "uploaded_count": len(uploaded_images),
        "failed_count": len(errors),
        "total_images": total_images,
        "indexing_status": idx_status,
        "images": uploaded_images,
        "errors": errors
    }


@router.post("/{id}/index", response_model=schemas.ProductIndexResponse, status_code=status.HTTP_200_OK)
def trigger_product_indexing(id: str, db: Session = Depends(get_db)):
    """
    Triggers incremental DINOv2 visual embedding generation and FAISS vector indexing for a product.
    Idempotent: Safe to call repeatedly.
    """
    db_product = crud.get_product(db, product_id=id)
    if not db_product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product '{id}' not found.")

    from app.visual_registry_service import index_product_images
    try:
        res = index_product_images(id, db)
        return {
            "success": res.get("success", True),
            "product_id": id,
            "status": res.get("status", "READY"),
            "images_indexed": res.get("images_indexed", 0),
            "embeddings_created": res.get("embeddings_created", 0),
            "faiss_updated": res.get("faiss_updated", False),
            "details": res
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Product indexing failed: {str(e)}"
        )


@router.get("/{id}/index-status", response_model=schemas.ProductIndexStatusResponse)
def get_product_index_status(id: str, db: Session = Depends(get_db)):
    """
    Returns current DINOv2 visual indexing and FAISS status for a product.
    """
    db_product = crud.get_product(db, product_id=id)
    if not db_product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product '{id}' not found.")

    from app import visual_index_service
    _, metadata = visual_index_service.get_visual_index()

    product_embeddings = crud.get_embeddings_for_product(db, id)
    total_images = len(db_product.images)
    indexed_count = len(product_embeddings)

    status_str = db_product.indexing_status or ("READY" if indexed_count > 0 and indexed_count == total_images else ("PENDING" if total_images == 0 else "INDEXING"))

    return {
        "success": True,
        "product_id": id,
        "status": status_str,
        "error": db_product.indexing_error,
        "total_images": total_images,
        "indexed_images": indexed_count,
        "embeddings_created": indexed_count,
        "faiss_updated": indexed_count > 0,
        "model_name": config.VISUAL_EMBEDDING_MODEL,
        "embedding_dimension": 384
    }



