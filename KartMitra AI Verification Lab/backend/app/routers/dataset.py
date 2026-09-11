from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pathlib import Path

from app import models, schemas, crud
from app.db import get_db
from app import dataset_service

router = APIRouter(prefix="/dataset", tags=["dataset"])


@router.get("/stats")
def get_dataset_stats(db: Session = Depends(get_db)):
    """Existing dataset stats endpoint."""
    total_products = db.query(models.Product).count()
    total_images = db.query(models.ProductImage).count()

    avg_images = float(total_images) / total_products if total_products > 0 else 0.0

    products = db.query(models.Product).all()
    products_without_enough = 0
    product_stats_list = []

    for p in products:
        p_images = p.images
        p_image_count = len(p_images)
        needs_more = p_image_count < 5
        if needs_more:
            products_without_enough += 1

        cov_res = dataset_service.get_product_dataset_coverage(str(p.id), db=db)

        product_stats_list.append({
            "id": str(p.id),
            "barcode": p.barcode,
            "name": p.name,
            "category": p.category or "Uncategorized",
            "total_images": max(p_image_count, cov_res.get("image_count", 0)),
            "needs_more_images": needs_more,
            "image_types": [img.image_type for img in p_images],
            "dataset_status": cov_res.get("status", "EMPTY")
        })

    return {
        "success": True,
        "stats": {
            "total_products": total_products,
            "total_images": total_images,
            "avg_images_per_product": avg_images,
            "products_without_enough_images": products_without_enough,
            "products": product_stats_list
        }
    }


@router.post("/products/{product_id}/images")
async def upload_dataset_images(
    product_id: str,
    file: List[UploadFile] = File(None),
    image: UploadFile = File(None),
    image_type: str = Form("raw"),
    db: Session = Depends(get_db)
):
    """
    Step 16D & 16E: Uploads product dataset images, performs quality check, and stores files safely.
    """
    prod = crud.get_product(db, product_id=product_id)
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product '{product_id}' not found.")

    files_to_process = []
    if file:
        files_to_process.extend(file)
    if image:
        files_to_process.append(image)

    if not files_to_process:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No image file provided.")

    upload_results = []
    for upload_file in files_to_process:
        contents = await upload_file.read()
        res = dataset_service.save_product_dataset_image(
            product_id=product_id,
            file_bytes=contents,
            filename=upload_file.filename or "image.jpg",
            image_type=image_type,
            db=db
        )

        if not res.get("success"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("error"))

        upload_results.append(res)

    first_res = upload_results[0] if upload_results else {}
    return {
        "success": True,
        "product_id": product_id,
        "image_id": first_res.get("image_id"),
        "status": "UPLOADED",
        "quality": first_res.get("quality", {}),
        "uploaded_count": len(upload_results),
        "results": upload_results
    }


@router.get("/products/{product_id}")
def get_product_dataset_info(product_id: str, db: Session = Depends(get_db)):
    """
    Step 16AO: Returns product dataset details, uploaded image files, and class mapping info.
    Auto-syncs images registered in ProductImage database table to dataset raw directory.
    """
    import shutil
    prod = crud.get_product(db, product_id=product_id)
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product '{product_id}' not found.")

    p_dir = dataset_service.get_product_dataset_dir(product_id)
    raw_dir = p_dir / "raw"

    # Sync images registered in ProductImage table to dataset raw directory for training & annotation
    from app.feature_matcher import resolve_image_path
    if prod.images:
        for db_img in prod.images:
            img_stem = f"img_{db_img.id[:10]}"
            existing = list(raw_dir.glob(f"{img_stem}.*"))
            if not existing:
                abs_p = resolve_image_path(db_img.image_path)
                if abs_p and abs_p.exists():
                    dest_file = raw_dir / f"{img_stem}{abs_p.suffix.lower()}"
                    try:
                        shutil.copy(abs_p, dest_file)
                    except Exception:
                        pass

    raw_images = [f.name for f in raw_dir.glob("*") if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]
    ann_files = [f.stem for f in (p_dir / "annotated").glob("*.txt")]

    cid = dataset_service.get_or_create_class_id_for_product(product_id, prod.name)
    cov_info = dataset_service.get_product_dataset_coverage(product_id, db=db)

    return {
        "success": True,
        "product": {
            "id": prod.id,
            "barcode": prod.barcode,
            "name": prod.name,
            "category": prod.category,
            "class_id": cid
        },
        "image_count": len(raw_images),
        "annotated_count": len(ann_files),
        "images": raw_images,
        "annotated_image_ids": ann_files,
        "coverage": cov_info.get("coverage", {}),
        "status": cov_info.get("status", "EMPTY")
    }


@router.get("/products/{product_id}/coverage")
def get_dataset_coverage(product_id: str, db: Session = Depends(get_db)):
    """
    Step 16G: Returns coverage breakdown per visual angle/condition.
    """
    return dataset_service.get_product_dataset_coverage(product_id, db=db)


@router.get("/classes")
def get_dataset_classes(db: Session = Depends(get_db)):
    """Returns clean dynamic class mapping derived from active products."""
    mapping = dataset_service.load_class_mapping(db=db)
    return {
        "success": True,
        "total_classes": len(mapping),
        "classes": mapping
    }


@router.api_route("/validate", methods=["GET", "POST"])
def validate_dataset_endpoint(db: Session = Depends(get_db)):
    """
    Step 16N: Pre-training dataset validation.
    """
    return dataset_service.validate_dataset(db=db)


@router.post("/annotate")
def save_annotation(payload: schemas.AnnotationSaveRequest, db: Session = Depends(get_db)):
    """
    Step 16H, 16I, 16L: Saves multi-product YOLO format bounding box annotations.
    """
    ann_list = [a.model_dump() for a in payload.annotations]
    res = dataset_service.save_yolo_annotation(
        image_id=payload.image_id,
        product_id=payload.product_id,
        annotations=ann_list,
        db=db
    )

    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("error"))

    return res


@router.get("/images/{image_id}")
def get_dataset_image_file(image_id: str, product_id: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Step 16AO: Serves a raw dataset image file for viewing or annotation interface.
    """
    # Search for image_id in dataset products directory
    products_dir = dataset_service.DATASET_BASE_DIR / "products"
    target_path = None

    if product_id:
        p_raw = products_dir / product_id / "raw"
        for img_file in p_raw.glob(f"{image_id}.*"):
            target_path = img_file
            break

    if not target_path and products_dir.exists():
        for p_folder in products_dir.iterdir():
            if p_folder.is_dir():
                for img_file in (p_folder / "raw").glob(f"{image_id}.*"):
                    target_path = img_file
                    break
            if target_path:
                break

    # Fallback to ProductImage DB lookup if image_id starts with img_ or is UUID
    if not target_path or not target_path.exists():
        from app.feature_matcher import resolve_image_path
        clean_id = image_id.replace("img_", "")
        db_imgs = db.query(models.ProductImage).all()
        for db_img in db_imgs:
            if db_img.id.startswith(clean_id) or db_img.id == image_id:
                target_path = resolve_image_path(db_img.image_path)
                if target_path and target_path.exists():
                    break

    if not target_path or not target_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Dataset image '{image_id}' not found.")

    return FileResponse(str(target_path))



@router.delete("/images/{image_id}")
def delete_dataset_image(image_id: str, product_id: str, db: Session = Depends(get_db)):
    """
    Step 16AA: Deletes a dataset image without deleting the product entity from PostgreSQL database.
    """
    p_dir = dataset_service.get_product_dataset_dir(product_id)
    raw_dir = p_dir / "raw"
    ann_dir = p_dir / "annotated"

    deleted = False
    for img_p in raw_dir.glob(f"{image_id}.*"):
        img_p.unlink(missing_ok=True)
        deleted = True

    ann_file = ann_dir / f"{image_id}.txt"
    if ann_file.exists():
        ann_file.unlink(missing_ok=True)

    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Image '{image_id}' not found in product dataset.")

    dataset_service.update_product_dataset_metadata(db, product_id)
    return {"success": True, "product_id": product_id, "image_id": image_id, "status": "DELETED"}
