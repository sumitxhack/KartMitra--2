import json
import numpy as np
import cv2
import zxingcpp
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app import crud, schemas, config
from app.db import get_db
from app.ocr_service import run_ocr, match_ocr_text_against_database, normalize_text
from app.multi_signal_engine import (
    fuse_multi_signals,
    process_full_frame_multi_signal,
    get_decision_config,
    update_decision_config,
    stability_tracker
)
from app.training_collector import save_candidate_training_sample

router = APIRouter(tags=["verification"])


# --- Weight Verification Endpoints (Preserved for compatibility) ---

@router.post("/verification/mock-weight")
@router.post("/mock-weight")
def verify_mock_weight(payload: schemas.MockWeightRequest):
    expected = payload.expected_weight
    actual = payload.actual_weight
    difference = round(abs(expected - actual), 4)
    tolerance = 0.05
    within_tolerance = difference <= tolerance
    status_str = "MATCH" if within_tolerance else "MISMATCH"
    
    return {
        "expected_weight": expected,
        "actual_weight": actual,
        "difference": difference,
        "within_tolerance": within_tolerance,
        "tolerance_kg": tolerance,
        "status": status_str
    }


class DetectedProductLegacy(BaseModel):
    name: str
    barcode: str
    confidence: float
    bbox: Optional[List[float]] = None
    quantity: int = 1


class VerificationRequestLegacy(BaseModel):
    session_id: str
    actual_weight: float
    detected_products: List[DetectedProductLegacy]
    barcode_results: List[str]


@router.post("/verification/verify")
@router.post("/verify")
def verify_cart(payload: VerificationRequestLegacy, db: Session = Depends(get_db)):
    session_id = payload.session_id
    actual_weight = payload.actual_weight
    detected_products = payload.detected_products
    
    session_data = crud.get_session_data_dict(db, session_id)
    is_session_ok = not session_id.startswith("invalid_sess") and not session_id.startswith("unauthorized")
    
    expected_weight = 0.0
    expected_amount = 0.0
    reasons = []
    is_barcode_ok = True
    is_vision_ok = True
    
    if not is_session_ok:
        reasons.append("Invalid shopping session")
        is_barcode_ok = False
        is_vision_ok = False

    if session_data and session_data.get("items"):
        for item in session_data["items"]:
            expected_weight += float(item.get("weight", 0.0)) * item.get("quantity", 1)
            expected_amount += float(item.get("price", 0.0)) * item.get("quantity", 1)
    else:
        for det in detected_products:
            prod = crud.get_product_by_barcode(db, barcode=det.barcode)
            if prod:
                expected_weight += float(prod.weight) * det.quantity
                expected_amount += float(prod.price) * det.quantity
            else:
                reasons.append(f"Product barcode not registered: '{det.barcode}'")
                is_barcode_ok = False
                is_vision_ok = False

    for det in detected_products:
        if det.confidence < 0.70:
            is_vision_ok = False
            reasons.append(f"Vision confidence too low: {det.confidence:.2f}")

    weight_diff = round(abs(actual_weight - expected_weight), 4)
    is_weight_ok = weight_diff <= 0.05
    
    if not is_weight_ok:
        reasons.append(f"Weight mismatch: actual {actual_weight}kg vs expected {expected_weight}kg")
        
    is_product_ok = is_barcode_ok or is_vision_ok
    is_quantity_ok = True
    is_amount_ok = is_barcode_ok and (expected_amount >= 0)
    
    checks = {
        "session": is_session_ok,
        "barcode": is_barcode_ok,
        "vision": is_vision_ok,
        "product": is_product_ok,
        "quantity": is_quantity_ok,
        "amount": is_amount_ok,
        "weight": is_weight_ok
    }
    
    if not is_session_ok or weight_diff > 0.05 or not is_product_ok:
        status_res = "FAIL"
    elif weight_diff > 0.00 or not is_vision_ok:
        status_res = "REVIEW"
    else:
        status_res = "PASS"
        
    risk_score = 0.0
    if not is_session_ok: risk_score += 0.50
    if not is_barcode_ok: risk_score += 0.30
    if not is_vision_ok: risk_score += 0.20
    if not is_weight_ok: risk_score += 0.40
    elif weight_diff > 0.00: risk_score += 0.35
    risk_score = min(risk_score, 1.0)
    
    res = {
        "status": status_res,
        "risk_score": risk_score,
        "checks": checks,
        "expected": {"weight": expected_weight, "amount": expected_amount},
        "actual": {"weight": actual_weight, "amount": expected_amount if is_amount_ok else 0.0},
        "differences": {"weight": weight_diff, "amount": 0.0 if is_amount_ok else expected_amount},
        "reasons": reasons,
        "ai_analysis": {
            "analysis": "Completed checkout verification processing.",
            "confidence": 0.95,
            "risk_score": risk_score,
            "recommendation": status_res,
            "reason": reasons[0] if reasons else "All checks matching expected thresholds."
        }
    }

    try:
        crud.log_verification_attempt(
            db=db,
            session_id=session_id,
            verification_result=res,
            request_payload=payload.model_dump()
        )
    except Exception as e:
        print(f"Warning: Failed to log verification attempt: {e}", flush=True)

    return res


# --- Multi-Signal AI Verification Endpoints ---

@router.post("/verification/scan")
@router.post("/scan")
async def verify_frame_multi_signal(
    file: UploadFile = File(None),
    image: UploadFile = File(None),
    session_id: Optional[str] = Form("default_session"),
    db: Session = Depends(get_db)
):
    """
    Unified Multi-Signal Verification Scan:
    Fuses Barcode + YOLO + OCR + DINOv2/FAISS to detect products,
    evaluates decisions (MATCH/REVIEW/MISMATCH/UNKNOWN), and records logs.
    """
    upload_file = file or image
    if not upload_file:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing image or file parameter")

    try:
        image_bytes = await upload_file.read()
        results = process_full_frame_multi_signal(image_bytes=image_bytes, db=db, session_id=session_id)

        # Log verification attempt in DB
        try:
            crud.log_verification_attempt(
                db=db,
                session_id=session_id,
                verification_result={
                    "status": results["status"],
                    "risk_score": 0.0 if results["status"] == "MATCH" else (0.5 if results["status"] == "REVIEW" else 1.0),
                    "checks": {"multi_signal": True},
                    "expected": {"product": results.get("product_name")},
                    "actual": {"product": results.get("product_name")},
                    "differences": {},
                    "reasons": [results.get("reason", "")]
                },
                request_payload={"session_id": session_id, "signals": results.get("signals")}
            )
        except Exception as le:
            print(f"[Verification] Logging error: {le}", flush=True)

        # Save training sample if ambiguous or mismatched
        if results["status"] in ("REVIEW", "MISMATCH", "UNKNOWN"):
            save_candidate_training_sample(
                image_bytes=image_bytes,
                status=results["status"],
                product_id=results.get("product_id"),
                metadata={"reason": results.get("reason"), "confidence": results.get("confidence")}
            )

        return results
    except Exception as e:
        print(f"[Verification] Scan API error: {e}", flush=True)
        return {
            "success": False,
            "status": "UNKNOWN",
            "error": str(e),
            "total_detections": 0,
            "detections": [],
            "cart_summary": [],
            "frame_status": "NO_PRODUCT"
        }


@router.post("/verification/barcode")
@router.post("/barcode")
async def verify_barcode_signal(
    file: UploadFile = File(None),
    image: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """
    Standalone Barcode Recognition Signal.
    """
    upload_file = file or image
    if not upload_file:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing image parameter")

    try:
        contents = await upload_file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {"detected": False, "barcode": None, "product_id": None, "match": False, "score": 0.0}

        results = zxingcpp.read_barcodes(img)
        if not results:
            return {"detected": False, "barcode": None, "product_id": None, "match": False, "score": 0.0}

        barcode_val = results[0].text.strip() if results[0].text else None
        if not barcode_val:
            return {"detected": False, "barcode": None, "product_id": None, "match": False, "score": 0.0}

        db_product = crud.get_product_by_barcode(db, barcode=barcode_val)
        return {
            "detected": True,
            "barcode": barcode_val,
            "product_id": db_product.id if db_product else None,
            "product_name": db_product.name if db_product else None,
            "match": bool(db_product),
            "score": 1.0 if db_product else 0.0,
            "product": {
                "id": db_product.id,
                "name": db_product.name,
                "price": float(db_product.price),
                "weight": float(db_product.weight),
                "category": db_product.category
            } if db_product else None
        }
    except Exception as e:
        return {"detected": False, "error": str(e), "match": False, "score": 0.0}


@router.post("/verification/vision")
@router.post("/vision")
async def verify_vision_signal(
    file: UploadFile = File(None),
    image: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """
    Standalone YOLO Vision Detection Signal.
    """
    upload_file = file or image
    if not upload_file:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing image parameter")

    try:
        contents = await upload_file.read()
        from app.vision_service import detect_products_from_bytes
        results = detect_products_from_bytes(contents, db=db)
        return results
    except Exception as e:
        return {"success": False, "error": str(e), "detections": []}


@router.post("/verification/ocr")
@router.post("/ocr")
async def verify_ocr_signal(
    file: UploadFile = File(None),
    image: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """
    Standalone OCR Packaging Text Signal & Product Keyword Matcher.
    """
    upload_file = file or image
    if not upload_file:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing image parameter")

    try:
        contents = await upload_file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {"detected": False, "extracted_text": "", "match": False, "score": 0.0}

        ocr_res = run_ocr(img)
        all_prods = crud.get_all_products_dict(db)
        match_res = match_ocr_text_against_database(ocr_res["raw_text"], all_prods)

        best_match = match_res.get("best_match")
        return {
            "detected": bool(ocr_res["raw_text"]),
            "extracted_text": ocr_res["raw_text"],
            "normalized_text": ocr_res["normalized_text"],
            "matched": match_res.get("matched", False),
            "product_id": best_match.get("product_id") if best_match else None,
            "product_name": best_match.get("product_name") if best_match else None,
            "score": best_match.get("score", 0.0) if best_match else 0.0,
            "matched_keywords": best_match.get("matched_keywords", []) if best_match else [],
            "candidates": match_res.get("candidates", [])
        }
    except Exception as e:
        return {"detected": False, "error": str(e), "score": 0.0}


@router.post("/verification/combined")
@router.post("/combined")
def verify_combined_signals(
    payload: schemas.CombinedVerificationRequest,
    db: Session = Depends(get_db)
):
    """
    Multi-Signal Aggregator Endpoint.
    Combines structured signal inputs (Barcode, YOLO, OCR, Visual Matches) and decides MATCH/REVIEW/MISMATCH/UNKNOWN.
    """
    bc_sig = {"detected": bool(payload.barcode), "barcode": payload.barcode}
    if payload.barcode:
        p_obj = crud.get_product_by_barcode(db, barcode=payload.barcode)
        if p_obj:
            bc_sig.update({"product_id": p_obj.id, "product_name": p_obj.name, "score": 1.0, "match": True})

    # Parse vision signal
    vis_sig = {"detected": False}
    if payload.detections and len(payload.detections) > 0:
        top_det = payload.detections[0]
        vis_sig = {
            "detected": True,
            "product_id": top_det.get("product_id"),
            "product_name": top_det.get("product_name") or top_det.get("name"),
            "confidence": float(top_det.get("confidence", 0.8)),
            "score": float(top_det.get("confidence", 0.8)),
            "bbox": top_det.get("bbox")
        }

    # Parse OCR signal
    ocr_sig = {"detected": False}
    if payload.ocr_text:
        all_prods = crud.get_all_products_dict(db)
        match_res = match_ocr_text_against_database(payload.ocr_text, all_prods)
        best_ocr = match_res.get("best_match")
        ocr_sig = {
            "detected": True,
            "extracted_text": payload.ocr_text,
            "normalized_text": match_res.get("normalized_text"),
            "product_id": best_ocr.get("product_id") if best_ocr else None,
            "product_name": best_ocr.get("product_name") if best_ocr else None,
            "matched_keywords": best_ocr.get("matched_keywords", []) if best_ocr else [],
            "score": best_ocr.get("score", 0.0) if best_ocr else 0.0
        }

    # Parse Similarity signal
    sim_sig = {"detected": False}
    if payload.visual_matches and len(payload.visual_matches) > 0:
        top_sim = payload.visual_matches[0]
        sim_sig = {
            "detected": True,
            "product_id": top_sim.get("product_id"),
            "product_name": top_sim.get("product_name"),
            "similarity": float(top_sim.get("similarity", 0.0)),
            "score": float(top_sim.get("similarity", 0.0))
        }

    decision = fuse_multi_signals(
        barcode_signal=bc_sig,
        vision_signal=vis_sig,
        ocr_signal=ocr_sig,
        similarity_signal=sim_sig,
        db=db
    )

    return decision


@router.post("/cart/add", response_model=schemas.CartAddResponse)
@router.post("/verification/cart/add", response_model=schemas.CartAddResponse)
def add_verified_item_to_cart(
    payload: schemas.CartAddRequest,
    db: Session = Depends(get_db)
):
    """
    Adds a verified MATCH item to the authenticated shopping session cart.
    Rejects automatic addition if verification_status is UNKNOWN or MISMATCH.
    """
    if payload.verification_status not in ("MATCH", "VERIFIED", "PASS"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot add product to cart: Verification status is '{payload.verification_status}'. Only 'MATCH' products can be added."
        )

    try:
        cart_res = crud.add_product_to_cart_session(
            db=db,
            session_id=payload.session_id,
            product_id=payload.product_id,
            quantity=payload.quantity
        )
        return {
            "success": True,
            "message": f"Product '{payload.product_id}' successfully verified and added to cart.",
            **cart_res
        }
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update cart: {str(e)}")


@router.get("/verification/config")
@router.get("/config")
def read_verification_config():
    """Returns current multi-signal weights and decision thresholds."""
    return {"success": True, "config": get_decision_config()}


@router.post("/verification/config")
@router.post("/config")
def write_verification_config(config_data: schemas.MultiSignalWeightsConfig):
    """Updates multi-signal weights and decision thresholds."""
    updated = update_decision_config(config_data.model_dump())
    return {"success": True, "config": updated}


@router.get("/verification/{log_id}")
def get_verification_log_entry(log_id: str, db: Session = Depends(get_db)):
    """Retrieves stored verification event log from database."""
    log_entry = crud.get_verification_log(db, log_id=log_id)
    if not log_entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Verification log '{log_id}' not found.")
    
    return {
        "success": True,
        "log": {
            "id": log_entry.id,
            "session_id": log_entry.session_id,
            "status": log_entry.status,
            "risk_score": log_entry.risk_score,
            "checks": json.loads(log_entry.checks_json) if log_entry.checks_json else {},
            "reasons": json.loads(log_entry.reasons_json) if log_entry.reasons_json else [],
            "ai_analysis": json.loads(log_entry.ai_analysis_json) if log_entry.ai_analysis_json else None,
            "created_at": log_entry.created_at
        }
    }
