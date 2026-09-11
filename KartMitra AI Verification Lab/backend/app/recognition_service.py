import time
import cv2
import numpy as np
import zxingcpp
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from app import crud, config
from app import visual_decision_service


def format_product_dict(prod: Any) -> Optional[Dict[str, Any]]:
    """Helper to convert database product record (SQLAlchemy model or dict) into standardized JSON product dict."""
    if not prod:
        return None
    if isinstance(prod, dict):
        return {
            "id": prod.get("id"),
            "barcode": prod.get("barcode"),
            "name": prod.get("name"),
            "price": float(prod.get("price", 0)),
            "weight": float(prod.get("weight", 0.0)),
            "category": prod.get("category"),
        }
    return {
        "id": getattr(prod, "id", None),
        "barcode": getattr(prod, "barcode", None),
        "name": getattr(prod, "name", None),
        "price": float(getattr(prod, "price", 0)),
        "weight": float(getattr(prod, "weight", 0.0)),
        "category": getattr(prod, "category", None),
    }


def perform_visual_matching(
    image_bytes: bytes,
    db: Optional[Session] = None,
    top_k: Optional[int] = None
) -> Dict[str, Any]:
    """
    Executes DINOv2 visual embedding matching against registered product images in FAISS vector index.
    Aggregates results at unique PRODUCT level, calculates Top-1/Top-2 margins, and applies Visual Decision Engine.
    """
    if top_k is None:
        top_k = config.VISUAL_TOP_K

    if not image_bytes:
        return {
            "success": False,
            "status": "UNKNOWN",
            "best_match": None,
            "candidates": [],
            "visual_match": {
                "similarity": 0.0,
                "top2_similarity": None,
                "margin": None,
                "decision": "UNKNOWN",
                "decision_level": "LOW",
                "best_reference_image_id": None,
                "reason": "No image data provided"
            },
            "performance": {"embedding_ms": 0, "faiss_search_ms": 0, "total_ms": 0}
        }

    start_time = time.perf_counter()
    try:
        from app.visual_embedding_service import generate_embedding_from_bytes
        from app import visual_index_service
        
        query_vec = generate_embedding_from_bytes(image_bytes)
        t_emb = time.perf_counter()

        raw_matches = visual_index_service.search_similar(query_vec, top_k=top_k * 3)
        t_faiss = time.perf_counter()

        embedding_ms = max(1, int((t_emb - start_time) * 1000))
        faiss_search_ms = max(1, int((t_faiss - t_emb) * 1000))
        total_ms = max(1, int((t_faiss - start_time) * 1000))

        if not raw_matches:
            eval_empty = visual_decision_service.evaluate_visual_match(0.0, None)
            return {
                "success": True,
                "status": "UNKNOWN",
                "best_match": None,
                "candidates": [],
                "visual_match": {
                    "similarity": 0.0,
                    "top2_similarity": None,
                    "margin": None,
                    "decision": "UNKNOWN",
                    "decision_level": "LOW",
                    "best_reference_image_id": None,
                    "reason": "No registered product has sufficient visual similarity."
                },
                "performance": {
                    "embedding_ms": embedding_ms,
                    "faiss_search_ms": faiss_search_ms,
                    "total_ms": total_ms
                }
            }

        # Step 14E & 14F: Group matches by product_id (Product-Level Aggregation)
        product_matches: Dict[str, Dict[str, Any]] = {}
        for m in raw_matches:
            pid = m.get("product_id")
            sim = float(m.get("similarity", 0.0))
            ref_img_id = m.get("product_image_id")
            ref_img_path = m.get("image_path")
            if not pid:
                continue

            if pid not in product_matches:
                prod_obj = crud.get_product(db, product_id=pid) if db is not None else None
                if db is not None and prod_obj is None:
                    # Skip deleted products not present in PostgreSQL
                    continue
                prod_name = prod_obj.name if prod_obj else f"Product {pid}"
                product_matches[pid] = {
                    "product_id": pid,
                    "product_name": prod_name,
                    "name": prod_name,
                    "similarity": round(sim, 4),
                    "reference_image_id": ref_img_id,
                    "matched_image_id": ref_img_id,
                    "matched_image_path": ref_img_path
                }
            else:
                if sim > product_matches[pid]["similarity"]:
                    product_matches[pid]["similarity"] = round(sim, 4)
                    product_matches[pid]["reference_image_id"] = ref_img_id
                    product_matches[pid]["matched_image_id"] = ref_img_id
                    product_matches[pid]["matched_image_path"] = ref_img_path

        # Unique product candidates sorted by max reference similarity score
        sorted_products = sorted(product_matches.values(), key=lambda c: c["similarity"], reverse=True)[:top_k]

        candidates = []
        for idx, c in enumerate(sorted_products):
            candidates.append({
                "rank": idx + 1,
                "product_id": c["product_id"],
                "product_name": c["product_name"],
                "similarity": c["similarity"],
                "reference_image_id": c["reference_image_id"]
            })

        best_match = sorted_products[0] if sorted_products else None
        top1_sim = best_match["similarity"] if best_match else 0.0
        top2_sim = sorted_products[1]["similarity"] if len(sorted_products) >= 2 else None

        # Step 14B & 14C: Decision Engine Evaluation
        decision_info = visual_decision_service.evaluate_visual_match(top1_sim, top2_sim)

        visual_match_detail = {
            "similarity": decision_info["top1_similarity"],
            "top2_similarity": decision_info["top2_similarity"],
            "margin": decision_info["margin"],
            "decision": decision_info["decision"],
            "decision_level": decision_info["decision_level"],
            "best_reference_image_id": best_match["reference_image_id"] if best_match else None,
            "reason": decision_info["reason"]
        }

        best_prod_dict = None
        if best_match and db is not None:
            p_obj = crud.get_product(db, product_id=best_match["product_id"])
            if p_obj:
                best_prod_dict = format_product_dict(p_obj)

        return {
            "success": True,
            "status": decision_info["decision"],
            "product": best_prod_dict,
            "best_match": best_match,
            "visual_match": visual_match_detail,
            "candidates": candidates,
            "performance": {
                "embedding_ms": embedding_ms,
                "faiss_search_ms": faiss_search_ms,
                "total_ms": total_ms
            }
        }
    except Exception as e:
        print(f"[Recognition Service] perform_visual_matching exception: {e}", flush=True)
        return {
            "success": False,
            "status": "UNKNOWN",
            "error": str(e),
            "best_match": None,
            "candidates": [],
            "visual_match": {
                "similarity": 0.0,
                "top2_similarity": None,
                "margin": None,
                "decision": "UNKNOWN",
                "decision_level": "LOW",
                "best_reference_image_id": None,
                "reason": f"Visual match exception: {str(e)}"
            },
            "performance": {"embedding_ms": 0, "faiss_search_ms": 0, "total_ms": 0}
        }


def identify_product_from_bytes(
    image_bytes: bytes,
    db: Optional[Session] = None,
    verify_confidence_threshold: float = 0.60
) -> Dict[str, Any]:
    """
    Combines Barcode Recognition, YOLO Object Detection, and DINOv2 Visual Embedding Match
    to identify products, utilizing the Step 14 Visual Decision Engine.
    """
    if not image_bytes:
        return {
            "status": "UNKNOWN",
            "product": {},
            "barcode": {"value": None, "product_id": None},
            "vision": {"product_id": None, "detection_confidence": 0.0},
            "visual_match": {
                "similarity": 0.0,
                "top2_similarity": None,
                "margin": None,
                "decision": "UNKNOWN",
                "decision_level": "LOW",
                "best_reference_image_id": None,
                "candidates": [],
                "reason": "No image data provided"
            },
            "reason": "No image data provided"
        }

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {
            "status": "UNKNOWN",
            "product": {},
            "barcode": {"value": None, "product_id": None},
            "vision": {"product_id": None, "detection_confidence": 0.0},
            "visual_match": {
                "similarity": 0.0,
                "top2_similarity": None,
                "margin": None,
                "decision": "UNKNOWN",
                "decision_level": "LOW",
                "best_reference_image_id": None,
                "candidates": [],
                "reason": "Invalid or unreadable image file format"
            },
            "reason": "Invalid or unreadable image file format"
        }

    # ==========================================
    # STEP 1: BARCODE DETECTION (Signal 1)
    # ==========================================
    barcode_val: Optional[str] = None
    barcode_product_raw: Any = None
    barcode_product_id: Optional[str] = None

    try:
        results = zxingcpp.read_barcodes(img)
        if results and len(results) > 0:
            raw_text = results[0].text
            if raw_text and raw_text.strip():
                barcode_val = raw_text.strip()
                if db is not None:
                    barcode_product_raw = crud.get_product_by_barcode(db, barcode=barcode_val)

                if barcode_product_raw:
                    barcode_product_id = (
                        barcode_product_raw.id
                        if hasattr(barcode_product_raw, "id")
                        else barcode_product_raw.get("id")
                    )
    except Exception as e:
        print(f"[Identify Service] Barcode scan exception: {e}", flush=True)

    barcode_info: Dict[str, Any] = {
        "value": barcode_val,
        "product_id": barcode_product_id,
    }

    # ==========================================
    # STEP 2: YOLO VISION DETECTION (Signal 2)
    # ==========================================
    vision_product_id: Optional[str] = None
    vision_confidence: float = 0.0
    has_vision_detection: bool = False
    raw_detections: List[Dict[str, Any]] = []

    try:
        from app.vision_service import detect_products_from_bytes
        det_result = detect_products_from_bytes(image_bytes, db=db, conf_threshold=0.15)
        if det_result.get("success") and det_result.get("detections"):
            raw_detections = det_result["detections"]
            if len(raw_detections) > 0:
                top_det = max(raw_detections, key=lambda d: d.get("confidence", 0.0))
                has_vision_detection = True
                vision_confidence = float(top_det.get("confidence", 0.0))
                vision_product_id = top_det.get("product_id")
    except Exception as e:
        print(f"[Identify Service] Vision AI exception: {e}", flush=True)

    vision_info: Dict[str, Any] = {
        "product_id": vision_product_id,
        "detection_confidence": round(vision_confidence, 4),
        "confidence": round(vision_confidence, 2)
    }

    # ==========================================
    # STEP 3: DINOv2 VISUAL EMBEDDING MATCH (Signal 3)
    # ==========================================
    vm_result = perform_visual_matching(image_bytes, db=db)
    visual_match_info = vm_result.get("visual_match", {})
    visual_match_info["candidates"] = vm_result.get("candidates", [])

    best_match = vm_result.get("best_match")
    vm_product_id = best_match.get("product_id") if best_match else None
    vm_similarity = float(visual_match_info.get("similarity", 0.0))
    vm_decision = visual_match_info.get("decision", "UNKNOWN")

    barcode_product = format_product_dict(barcode_product_raw)
    vm_product_raw = crud.get_product(db, product_id=vm_product_id) if (vm_product_id and db is not None) else None
    vm_product = format_product_dict(vm_product_raw)

    # ==========================================
    # STEP 3.5: OCR PACKAGING TEXT (Signal 4)
    # ==========================================
    ocr_product_id: Optional[str] = None
    ocr_score: float = 0.0
    ocr_extracted_text: str = ""
    ocr_matched_kws: List[str] = []
    ocr_info: Dict[str, Any] = {
        "detected": False,
        "extracted_text": "",
        "normalized_text": "",
        "product_id": None,
        "product_name": None,
        "matched_keywords": [],
        "score": 0.0
    }

    try:
        from app.ocr_service import run_ocr, match_ocr_text_against_database, normalize_text
        ocr_res = run_ocr(img)
        ocr_extracted_text = ocr_res.get("raw_text", "")
        if ocr_extracted_text:
            all_prods = crud.get_all_products_dict(db) if db is not None else []
            match_res = match_ocr_text_against_database(ocr_extracted_text, all_prods)
            best_ocr = match_res.get("best_match")
            if best_ocr:
                ocr_product_id = best_ocr.get("product_id")
                ocr_score = float(best_ocr.get("score", 0.0))
                ocr_matched_kws = best_ocr.get("matched_keywords", [])
                ocr_info = {
                    "detected": True,
                    "extracted_text": ocr_extracted_text,
                    "normalized_text": ocr_res.get("normalized_text", normalize_text(ocr_extracted_text)),
                    "product_id": ocr_product_id,
                    "product_name": best_ocr.get("product_name"),
                    "matched_keywords": ocr_matched_kws,
                    "score": round(ocr_score, 4)
                }
    except Exception as oe:
        print(f"[Identify Service] OCR extraction exception: {oe}", flush=True)

    # ==========================================
    # STEP 4: FUSION DECISION & MISMATCH RULES
    # ==========================================
    status: str = "UNKNOWN"
    reason: str = visual_match_info.get("reason", "No barcode or product detected")
    final_product: Optional[Dict[str, Any]] = None

    # Check for Mismatch / Conflicts first
    if barcode_product is not None:
        final_product = barcode_product
        if vm_product_id is not None and barcode_product["id"] != vm_product_id and vm_similarity >= 0.75:
            status = "MISMATCH"
            reason = f"Barcode ({barcode_product.get('name')}) and visual match ({vm_product.get('name') if vm_product else vm_product_id}) disagree."
        elif ocr_product_id is not None and barcode_product["id"] != ocr_product_id and ocr_score >= 0.65:
            status = "MISMATCH"
            reason = f"Barcode ({barcode_product.get('name')}) and packaging OCR ({ocr_info.get('product_name')}) disagree."
        else:
            status = "MATCH"
            reason = f"Product identified via barcode ({barcode_val})."

    elif barcode_val is not None:
        if vm_product is not None and vm_decision == "MATCH":
            status = "MISMATCH"
            reason = f"Unregistered barcode '{barcode_val}' conflicts with visual reference match ({vm_product.get('name')})"
            final_product = vm_product
        else:
            status = "UNKNOWN"
            reason = f"Barcode '{barcode_val}' not found in database."
            final_product = None

    # NO Barcode detected -> Fuse OCR + Visual Match
    else:
        if ocr_product_id and (ocr_score >= 0.60 or (vm_product_id == ocr_product_id and vm_similarity >= 0.65)):
            p_obj = crud.get_product(db, product_id=ocr_product_id) if db is not None else None
            final_product = format_product_dict(p_obj)
            status = "MATCH"
            reason = f"Packaging OCR and visual match confirmed '{final_product.get('name') if final_product else ocr_product_id}' (OCR: {ocr_score:.2f}, Visual: {vm_similarity:.2f})."
        elif vm_product is not None:
            final_product = vm_product
            status = vm_decision
            reason = visual_match_info.get("reason", f"Visual decision: {vm_decision}")
        else:
            status = "UNKNOWN"
            final_product = None
            reason = "No registered product has sufficient visual similarity or OCR match."

    cart_summary = []
    if final_product and status == "MATCH":
        p_price = float(final_product.get("price", 0.0))
        p_weight = float(final_product.get("weight", 0.0))
        cart_summary.append({
            "product_id": final_product.get("id"),
            "name": final_product.get("name"),
            "quantity": 1,
            "unit_price": p_price,
            "total_price": p_price,
            "unit_weight": p_weight,
            "total_expected_weight": p_weight,
            "expected_weight": p_weight,
            "status": "VERIFIED",
            "barcode": barcode_val or final_product.get("barcode")
        })

    cart_total_price = round(sum(item["total_price"] for item in cart_summary), 2)
    cart_expected_weight = round(sum(item["total_expected_weight"] for item in cart_summary), 4)

    return {
        "status": status,
        "product": final_product if final_product is not None else {},
        "barcode": barcode_info,
        "vision": vision_info,
        "ocr": ocr_info,
        "visual_match": visual_match_info,
        "candidates": vm_result.get("candidates", []),
        "performance": vm_result.get("performance", {}),
        "reason": reason,
        "cart_summary": cart_summary,
        "cart": {
            "total_items": sum(item["quantity"] for item in cart_summary),
            "total_price": cart_total_price,
            "expected_weight": cart_expected_weight
        }
    }


def associate_barcode_with_product(
    barcodes: List[Dict[str, Any]],
    product_detections: List[Dict[str, Any]],
    max_distance_px: float = config.BARCODE_ASSOCIATION_DISTANCE_PX
) -> List[Dict[str, Any]]:
    """
    Step 15L: Spatially associates scanned barcodes with product bounding boxes based on:
    1. Barcode center inside product bbox.
    2. Significant bbox overlap.
    3. Nearest product bbox center within max_distance_px.
    """
    associated_barcodes = []

    for b_idx, bc in enumerate(barcodes, start=1):
        bc_val = bc.get("value")
        bc_prod_id = bc.get("product_id")
        bc_bbox = bc.get("bbox", {})
        
        bx1 = bc_bbox.get("x1", 0)
        by1 = bc_bbox.get("y1", 0)
        bx2 = bc_bbox.get("x2", 0)
        by2 = bc_bbox.get("y2", 0)
        bcx = (bx1 + bx2) / 2.0 if (bx1 or bx2) else None
        bcy = (by1 + by2) / 2.0 if (by1 or by2) else None

        best_assoc_det_id = None
        min_dist = float("inf")

        if bcx is not None and bcy is not None:
            for det in product_detections:
                p_bbox = det.get("bbox", {})
                px1 = p_bbox.get("x1", 0)
                py1 = p_bbox.get("y1", 0)
                px2 = p_bbox.get("x2", 0)
                py2 = p_bbox.get("y2", 0)

                # Check 1: Barcode center inside product bbox
                if px1 <= bcx <= px2 and py1 <= bcy <= py2:
                    best_assoc_det_id = det.get("detection_id")
                    break

                # Check 2: Bbox overlap
                overlap_x = max(0, min(bx2, px2) - max(bx1, px1))
                overlap_y = max(0, min(by2, py2) - max(by1, py1))
                if overlap_x > 0 and overlap_y > 0:
                    best_assoc_det_id = det.get("detection_id")
                    break

                # Check 3: Distance between centers
                pcx = (px1 + px2) / 2.0
                pcy = (py1 + py2) / 2.0
                dist = np.hypot(bcx - pcx, bcy - pcy)

                if dist <= max_distance_px and dist < min_dist:
                    min_dist = dist
                    best_assoc_det_id = det.get("detection_id")
        else:
            # Fallback when barcode coordinates unavailable: match if single product or 1-to-1 index
            if len(barcodes) == 1 and len(product_detections) >= 1:
                best_assoc_det_id = product_detections[0].get("detection_id")

        associated_barcodes.append({
            "barcode_detection_id": b_idx,
            "barcode_value": bc_val,
            "barcode_bbox": bc_bbox,
            "associated_product_id": bc_prod_id,
            "associated_detection_id": best_assoc_det_id
        })

    return associated_barcodes


def aggregate_detected_products(
    detections: List[Dict[str, Any]],
    db: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Step 15H & 15I & 15J: Aggregates verified matched detections by product_id.
    Groups ONLY products that have decision == 'MATCH'.
    Does NOT aggregate UNKNOWN or REVIEW detections.
    Computes price and weight totals using database values.
    """
    matched_groups: Dict[str, Dict[str, Any]] = {}

    for det in detections:
        dec = det.get("decision")
        p_info = det.get("product") or {}
        pid = det.get("product_id") or p_info.get("id")

        if dec != "MATCH" or not pid:
            continue

        p_name = p_info.get("name", f"Product {pid}")
        p_price = float(p_info.get("price", 0.0))
        p_weight = float(p_info.get("weight", 0.0))

        if pid not in matched_groups:
            # If prices or weights are 0, try db lookup
            if (p_price == 0.0 or p_weight == 0.0) and db is not None:
                p_obj = crud.get_product(db, product_id=pid)
                if p_obj:
                    p_name = p_obj.name
                    p_price = float(p_obj.price)
                    p_weight = float(p_obj.weight)

            matched_groups[pid] = {
                "product_id": pid,
                "name": p_name,
                "quantity": 1,
                "unit_price": p_price,
                "total_price": p_price,
                "unit_weight": p_weight,
                "total_expected_weight": p_weight,
                "expected_weight": p_weight,
                "status": "VERIFIED"
            }
        else:
            matched_groups[pid]["quantity"] += 1
            qty = matched_groups[pid]["quantity"]
            matched_groups[pid]["total_price"] = round(p_price * qty, 2)
            matched_groups[pid]["total_expected_weight"] = round(p_weight * qty, 4)
            matched_groups[pid]["expected_weight"] = round(p_weight * qty, 4)

    return list(matched_groups.values())


def perform_multi_product_recognition(
    image_bytes: bytes,
    db: Optional[Session] = None,
    top_k: Optional[int] = None
) -> Dict[str, Any]:
    """
    Step 15: Multi-Product Detection, Crop Extraction, DINOv2 Batch Embedding, FAISS Search,
    Step 14 Decision Engine, Quantity Aggregation & Frame-Level Cart Verification.
    """
    if top_k is None:
        top_k = config.VISUAL_TOP_K

    if not image_bytes:
        return {
            "success": True,
            "total_detections": 0,
            "detections": [],
            "cart_summary": [],
            "summary": {"matched": 0, "review": 0, "unknown": 0, "mismatch": 0},
            "cart": {"total_items": 0, "total_price": 0, "expected_weight": 0.0},
            "frame_status": "NO_PRODUCT"
        }

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {
            "success": False,
            "error": "Invalid or unreadable image file format",
            "total_detections": 0,
            "detections": [],
            "cart_summary": [],
            "summary": {"matched": 0, "review": 0, "unknown": 0, "mismatch": 0},
            "cart": {"total_items": 0, "total_price": 0, "expected_weight": 0.0},
            "frame_status": "NO_PRODUCT"
        }

    img_h, img_w = img.shape[:2]

    # ==========================================
    # STEP 15A & 15B: YOLO N-DETECTIONS & CROPS
    # ==========================================
    from app.vision_service import extract_crops_and_detections
    det_data = extract_crops_and_detections(img)
    raw_detections = det_data.get("raw_detections", [])

    # Step 15AB: Empty frame / full-frame fallback check
    if not raw_detections:
        # Check if full image matches any registered FAISS product
        try:
            from app.visual_embedding_service import generate_embedding_from_image
            from app import visual_index_service
            full_vec = generate_embedding_from_image(img)
            full_matches = visual_index_service.search_similar(full_vec, top_k=1)
            if full_matches and float(full_matches[0].get("similarity", 0.0)) >= config.VISUAL_REVIEW_THRESHOLD:
                raw_detections = [{
                    "detection_id": 1,
                    "bbox": {
                        "x1": 0,
                        "y1": 0,
                        "x2": img_w,
                        "y2": img_h,
                        "x": 0,
                        "y": 0,
                        "width": img_w,
                        "height": img_h
                    },
                    "detection_confidence": 1.0,
                    "yolo_class_id": 0,
                    "yolo_class_name": "full_frame",
                    "crop_img": img,
                    "is_too_small": False
                }]
        except Exception as fe:
            print(f"[Multi Recognition] Full frame fallback exception: {fe}", flush=True)

    if not raw_detections:
        return {
            "success": True,
            "frame": {"width": img_w, "height": img_h},
            "total_detections": 0,
            "detections": [],
            "cart_summary": [],
            "summary": {"matched": 0, "review": 0, "unknown": 0, "mismatch": 0},
            "cart": {"total_items": 0, "total_price": 0, "expected_weight": 0.0},
            "frame_status": "NO_PRODUCT"
        }


    # ==========================================
    # STEP 15K: MULTIPLE BARCODE SCANNING
    # ==========================================
    scanned_barcodes: List[Dict[str, Any]] = []
    try:
        barcode_results = zxingcpp.read_barcodes(img)
        for b_res in barcode_results:
            b_val = b_res.text.strip() if b_res.text else None
            if not b_val:
                continue

            b_prod_raw = crud.get_product_by_barcode(db, barcode=b_val) if db is not None else None
            b_prod_id = b_prod_raw.id if b_prod_raw else None

            # Extract barcode bbox from position if present
            bx1, by1, bx2, by2 = 0, 0, 0, 0
            if hasattr(b_res, "position") and b_res.position:
                try:
                    pts = [(p.x, p.y) for p in [b_res.position.top_left, b_res.position.top_right, b_res.position.bottom_right, b_res.position.bottom_left]]
                    xs = [p[0] for p in pts]
                    ys = [p[1] for p in pts]
                    bx1, by1, bx2, by2 = min(xs), min(ys), max(xs), max(ys)
                except Exception:
                    pass

            scanned_barcodes.append({
                "value": b_val,
                "product_id": b_prod_id,
                "bbox": {"x1": bx1, "y1": by1, "x2": bx2, "y2": by2}
            })
    except Exception as be:
        print(f"[Multi-Product Service] Barcode scan exception: {be}", flush=True)

    # Step 15L: Barcode <-> Visual Product Spatial Association
    assoc_barcodes = associate_barcode_with_product(scanned_barcodes, raw_detections)
    assoc_by_det_id = {ab["associated_detection_id"]: ab for ab in assoc_barcodes if ab.get("associated_detection_id") is not None}

    # ==========================================
    # STEP 15C & 15U: BATCH DINOv2 EMBEDDINGS
    # ==========================================
    from app.visual_embedding_service import generate_embeddings_from_images
    from app import visual_index_service, visual_decision_service

    crop_images = [d["crop_img"] for d in raw_detections]
    embeddings = generate_embeddings_from_images(crop_images)

    processed_detections: List[Dict[str, Any]] = []

    matched_cnt = 0
    review_cnt = 0
    unknown_cnt = 0
    mismatch_cnt = 0

    for idx, raw in enumerate(raw_detections):
        det_id = raw["detection_id"]
        bbox = raw["bbox"]
        yolo_cls_name = raw["yolo_class_name"]
        yolo_conf = raw["detection_confidence"]

        if raw.get("is_too_small"):
            # Step 15X: Occluded/too small crop -> REVIEW
            review_cnt += 1
            processed_detections.append({
                "detection_id": det_id,
                "bbox": bbox,
                "yolo": {
                    "class_name": yolo_cls_name,
                    "detection_confidence": yolo_conf
                },
                "visual_match": {
                    "product_id": None,
                    "product_name": None,
                    "similarity": 0.0,
                    "top2_similarity": None,
                    "margin": None,
                    "decision": "REVIEW",
                    "best_reference_image_id": None,
                    "reason": "Product crop is too small or occluded."
                },
                "product_id": None,
                "product": None,
                "similarity": 0.0,
                "margin": None,
                "decision": "REVIEW",
                "reason": "Product crop is too small or occluded."
            })
            continue

        query_vec = embeddings[idx] if idx < len(embeddings) else None
        raw_matches = visual_index_service.search_similar(query_vec, top_k=top_k * 3) if query_vec is not None else []

        # Product-level aggregation across FAISS candidates
        product_matches: Dict[str, Dict[str, Any]] = {}
        for m in raw_matches:
            pid = m.get("product_id")
            sim = float(m.get("similarity", 0.0))
            ref_img_id = m.get("product_image_id")
            if not pid:
                continue

            if pid not in product_matches:
                p_obj = crud.get_product(db, product_id=pid) if db is not None else None
                if db is not None and p_obj is None:
                    # Skip deleted products not present in PostgreSQL
                    continue
                p_name = p_obj.name if p_obj else f"Product {pid}"
                product_matches[pid] = {
                    "product_id": pid,
                    "product_name": p_name,
                    "similarity": round(sim, 4),
                    "reference_image_id": ref_img_id
                }
            else:
                if sim > product_matches[pid]["similarity"]:
                    product_matches[pid]["similarity"] = round(sim, 4)
                    product_matches[pid]["reference_image_id"] = ref_img_id

        sorted_candidates = sorted(product_matches.values(), key=lambda c: c["similarity"], reverse=True)[:top_k]

        candidates = [
            {
                "rank": c_idx + 1,
                "product_id": c["product_id"],
                "product_name": c["product_name"],
                "similarity": c["similarity"],
                "reference_image_id": c["reference_image_id"]
            }
            for c_idx, c in enumerate(sorted_candidates)
        ]

        best_cand = sorted_candidates[0] if sorted_candidates else None
        top1_sim = best_cand["similarity"] if best_cand else 0.0
        top2_sim = sorted_candidates[1]["similarity"] if len(sorted_candidates) >= 2 else None

        decision_info = visual_decision_service.evaluate_visual_match(top1_sim, top2_sim)
        v_decision = decision_info["decision"]

        # Step 15E: UNKNOWN Objects
        if v_decision == "UNKNOWN":
            vm_product_id = None
            vm_product_dict = None
        else:
            vm_product_id = best_cand["product_id"] if best_cand else None
            p_obj = crud.get_product(db, product_id=vm_product_id) if (vm_product_id and db is not None) else None
            vm_product_dict = format_product_dict(p_obj) if p_obj else None

        # Check associated barcode for this detection
        assoc_bc = assoc_by_det_id.get(det_id)
        final_decision = v_decision
        final_reason = decision_info["reason"]

        if assoc_bc and assoc_bc.get("barcode_value"):
            bc_val = assoc_bc["barcode_value"]
            bc_pid = assoc_bc.get("associated_product_id")

            if bc_pid and vm_product_id:
                if bc_pid == vm_product_id:
                    if v_decision == "MATCH":
                        final_decision = "MATCH"
                        final_reason = f"Barcode ({bc_val}) and visual match agree."
                    elif v_decision == "REVIEW":
                        final_decision = "REVIEW"
                        final_reason = f"Barcode matches product ({bc_val}) but visual similarity is in review threshold."
                else:
                    # Barcode & Visual Disagree!
                    final_decision = "MISMATCH"
                    final_reason = f"Barcode product ({bc_pid}) and visual match product ({vm_product_id}) disagree."
            elif bc_pid and not vm_product_id:
                p_obj = crud.get_product(db, product_id=bc_pid) if db is not None else None
                vm_product_dict = format_product_dict(p_obj)
                vm_product_id = bc_pid
                final_decision = "MATCH"
                final_reason = f"Product identified via associated barcode ({bc_val})."

        if final_decision == "MATCH":
            matched_cnt += 1
        elif final_decision == "MISMATCH":
            mismatch_cnt += 1
        elif final_decision == "REVIEW":
            review_cnt += 1
        else:
            unknown_cnt += 1

        processed_detections.append({
            "detection_id": det_id,
            "bbox": bbox,
            "yolo": {
                "class_name": yolo_cls_name,
                "detection_confidence": yolo_conf
            },
            "visual_match": {
                "product_id": vm_product_id,
                "product_name": vm_product_dict.get("name") if vm_product_dict else None,
                "similarity": decision_info["top1_similarity"],
                "top2_similarity": decision_info["top2_similarity"],
                "margin": decision_info["margin"],
                "decision": final_decision,
                "best_reference_image_id": best_cand["reference_image_id"] if best_cand else None,
                "candidates": candidates
            },
            "product_id": vm_product_id if final_decision == "MATCH" else (vm_product_id if final_decision in ("REVIEW", "MISMATCH") else None),
            "product": vm_product_dict if final_decision in ("MATCH", "REVIEW", "MISMATCH") else None,
            "similarity": decision_info["top1_similarity"],
            "margin": decision_info["margin"],
            "decision": final_decision,
            "associated_barcode": assoc_bc.get("barcode_value") if assoc_bc else None,
            "reason": final_reason
        })

    # ==========================================
    # STEP 15H & 15I & 15J: CART AGGREGATION
    # ==========================================
    cart_summary = aggregate_detected_products(processed_detections, db=db)

    total_items = sum(item["quantity"] for item in cart_summary)
    total_price = round(sum(item["total_price"] for item in cart_summary), 2)
    expected_weight = round(sum(item["total_expected_weight"] for item in cart_summary), 4)

    # ==========================================
    # STEP 15N: FRAME-LEVEL VERIFICATION STATUS
    # ==========================================
    if mismatch_cnt > 0:
        frame_status = "MISMATCH"
    elif review_cnt > 0 or unknown_cnt > 0:
        frame_status = "REVIEW"
    elif matched_cnt > 0 and (matched_cnt == len(processed_detections)):
        frame_status = "VERIFIED"
    else:
        frame_status = "REVIEW"

    return {
        "success": True,
        "frame": {"width": img_w, "height": img_h},
        "total_detections": len(processed_detections),
        "detections": processed_detections,
        "cart_summary": cart_summary,
        "summary": {
            "matched": matched_cnt,
            "review": review_cnt,
            "unknown": unknown_cnt,
            "mismatch": mismatch_cnt
        },
        "cart": {
            "total_items": total_items,
            "total_price": total_price,
            "expected_weight": expected_weight
        },
        "frame_status": frame_status
    }



