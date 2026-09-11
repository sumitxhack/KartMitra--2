from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
import numpy as np
import cv2
import zxingcpp

from app import crud
from app.db import get_db

router = APIRouter(prefix="/recognition", tags=["recognition"])


@router.post("/barcode")
async def recognize_barcode(
    file: UploadFile = File(None),
    image: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    upload_file = file or image
    if not upload_file:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing image or file parameter")

    try:
        contents = await upload_file.read()
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

        # Query SQLAlchemy database for matching barcode
        db_product = crud.get_product_by_barcode(db, barcode=barcode_value)

        if db_product:
            return {
                "success": True,
                "barcode": barcode_value,
                "found": True,
                "product": {
                    "id": db_product.id,
                    "barcode": db_product.barcode,
                    "name": db_product.name,
                    "price": float(db_product.price),
                    "weight": db_product.weight,
                    "category": db_product.category,
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
        return {"success": False, "error": f"API failure: {str(e)}"}


@router.post("/detect")
async def detect_objects(
    file: UploadFile = File(None),
    image: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    upload_file = file or image
    if not upload_file:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing image or file parameter")

    try:
        contents = await upload_file.read()
        from app.vision_service import detect_products_from_bytes
        results = detect_products_from_bytes(contents, db=db)
        return results
    except Exception as e:
        print(f"Error in detect API: {e}", flush=True)
        return {"success": False, "error": str(e), "detections": []}


@router.post("/identify")
async def identify_product(
    file: UploadFile = File(None),
    image: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    upload_file = file or image
    if not upload_file:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing image or file parameter")

    try:
        contents = await upload_file.read()
        from app.recognition_service import identify_product_from_bytes
        results = identify_product_from_bytes(contents, db=db)
        return results
    except Exception as e:
        print(f"Error in identify API: {e}", flush=True)
        return {
            "status": "UNKNOWN",
            "product": None,
            "barcode": {"value": None, "product_id": None},
            "vision": {"product_id": None, "confidence": 0.0},
            "reason": f"API Error: {str(e)}"
        }


@router.post("/visual-match")
async def visual_match_product(
    file: UploadFile = File(None),
    image: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """
    Generates DINOv2 visual embedding for uploaded photo/crop and matches against registered FAISS index.
    Returns Top-K similarity product candidates and match decision.
    """
    upload_file = file or image
    if not upload_file:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing image or file parameter")

    try:
        contents = await upload_file.read()
        from app.recognition_service import perform_visual_matching
        results = perform_visual_matching(contents, db=db)
        return results
    except Exception as e:
        print(f"Error in visual-match API: {e}", flush=True)
        return {
            "success": False,
            "status": "UNKNOWN",
            "error": str(e),
            "best_match": None,
            "candidates": []
        }


@router.post("/multi")
async def recognize_multi_products(
    file: UploadFile = File(None),
    image: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """
    Step 15G: Multi-Product Detection, Crop Extraction, DINOv2 Batch Embedding, FAISS Search,
    Quantity Counting, Per-Product Cart Summary, and Frame Verification Endpoint.
    """
    upload_file = file or image
    if not upload_file:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing image or file parameter")

    try:
        contents = await upload_file.read()
        from app.recognition_service import perform_multi_product_recognition
        results = perform_multi_product_recognition(contents, db=db)
        return results
    except Exception as e:
        print(f"Error in multi-product recognition API: {e}", flush=True)
        return {
            "success": False,
            "error": f"Multi-product API Failure: {str(e)}",
            "total_detections": 0,
            "detections": [],
            "cart_summary": [],
            "summary": {"matched": 0, "review": 0, "unknown": 0, "mismatch": 0},
            "cart": {"total_items": 0, "total_price": 0, "expected_weight": 0.0},
            "frame_status": "REVIEW"
        }


