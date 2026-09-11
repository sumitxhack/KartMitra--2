import time
import json
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from app import config, crud
from app.ocr_service import run_ocr, match_ocr_text_against_database, normalize_text
from app.visual_decision_service import evaluate_visual_match


# Global configurable weights and thresholds (can be updated via API)
DECISION_CONFIG = {
    "barcode_weight": 0.40,
    "vision_weight": 0.25,
    "ocr_weight": 0.20,
    "similarity_weight": 0.15,
    "match_threshold": 0.70,
    "review_threshold": 0.45,
    "similarity_match_threshold": 0.75,
    "similarity_review_threshold": 0.55,
    "temporal_stability_frames": 3,
}


def get_decision_config() -> Dict[str, Any]:
    return dict(DECISION_CONFIG)


def update_decision_config(new_config: Dict[str, Any]) -> Dict[str, Any]:
    global DECISION_CONFIG
    for k, v in new_config.items():
        if k in DECISION_CONFIG and v is not None:
            DECISION_CONFIG[k] = type(DECISION_CONFIG[k])(v)
    return dict(DECISION_CONFIG)


class DetectionStabilityTracker:
    """
    Tracks detected products across consecutive video frames to prevent duplicate cart additions.
    Only triggers cart addition when a product remains stable for N consecutive frames.
    """
    def __init__(self, required_frames: int = 3, cooldown_seconds: float = 4.0):
        self.required_frames = required_frames
        self.cooldown_seconds = cooldown_seconds
        self.history: Dict[str, List[float]] = {}  # product_id -> [timestamps]
        self.added_products: Dict[str, float] = {}  # product_id -> last_added_timestamp

    def record_detection(self, product_id: Optional[str]) -> Tuple[bool, str]:
        """
        Records a detection event for a product.
        Returns (should_add_to_cart: bool, reason: str).
        """
        now = time.time()
        if not product_id:
            return False, "No product detected"

        # Check cooldown
        last_added = self.added_products.get(product_id, 0)
        if (now - last_added) < self.cooldown_seconds:
            return False, f"Product '{product_id}' is in cooldown ({round(self.cooldown_seconds - (now - last_added), 1)}s remaining)"

        # Append to history
        if product_id not in self.history:
            self.history[product_id] = []

        # Keep history within last 5 seconds
        self.history[product_id] = [t for t in self.history[product_id] if (now - t) <= 5.0]
        self.history[product_id].append(now)

        consecutive_count = len(self.history[product_id])
        if consecutive_count >= self.required_frames:
            self.added_products[product_id] = now
            self.history[product_id] = []
            return True, f"Stable detection verified across {consecutive_count} consecutive frames"

        return False, f"Verifying stability ({consecutive_count}/{self.required_frames} frames)"

    def clear(self):
        self.history.clear()
        self.added_products.clear()


# Singleton stability tracker
stability_tracker = DetectionStabilityTracker()


def format_product_dict(prod: Any) -> Optional[Dict[str, Any]]:
    """Helper to convert product model or dict into standardized dict."""
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
            "description": prod.get("description"),
            "keywords": prod.get("keywords") or [],
            "ocr_text": prod.get("ocr_text")
        }
    kws = []
    if getattr(prod, "keywords", None):
        try:
            kws = json.loads(prod.keywords) if prod.keywords.startswith("[") else [k.strip() for k in prod.keywords.split(",") if k.strip()]
        except Exception:
            kws = [k.strip() for k in prod.keywords.split(",") if k.strip()]

    return {
        "id": getattr(prod, "id", None),
        "barcode": getattr(prod, "barcode", None),
        "name": getattr(prod, "name", None),
        "price": float(getattr(prod, "price", 0)),
        "weight": float(getattr(prod, "weight", 0.0)),
        "category": getattr(prod, "category", None),
        "description": getattr(prod, "description", None),
        "keywords": kws,
        "ocr_text": getattr(prod, "ocr_text", None)
    }


def fuse_multi_signals(
    barcode_signal: Dict[str, Any],
    vision_signal: Dict[str, Any],
    ocr_signal: Dict[str, Any],
    similarity_signal: Dict[str, Any],
    db: Optional[Session] = None,
    weights_override: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Multi-Signal Decision Engine Core.
    Fuses 4 distinct signals:
    1. Barcode Detection (zxing-cpp)
    2. Vision Object Detection (YOLO)
    3. Packaging Text OCR (RapidOCR + Fuzzy Keyword Matcher)
    4. Reference Image Similarity (DINOv2 + FAISS)

    Evaluates agreement, conflicts, and produces final decision:
    MATCH | REVIEW | MISMATCH | UNKNOWN
    """
    cfg = get_decision_config()
    if weights_override:
        cfg.update(weights_override)

    w_barcode = float(cfg["barcode_weight"])
    w_vision = float(cfg["vision_weight"])
    w_ocr = float(cfg["ocr_weight"])
    w_sim = float(cfg["similarity_weight"])
    match_th = float(cfg["match_threshold"])
    review_th = float(cfg["review_threshold"])

    # Extract individual signals
    bc_detected = bool(barcode_signal.get("detected") or barcode_signal.get("barcode") or barcode_signal.get("value"))
    bc_val = barcode_signal.get("barcode") or barcode_signal.get("value")
    bc_pid = barcode_signal.get("product_id")
    bc_pname = barcode_signal.get("product_name")
    bc_score = float(barcode_signal.get("score", 1.0 if (bc_detected and bc_pid) else 0.0))

    vis_detected = bool(vision_signal.get("detected") or (vision_signal.get("confidence", 0.0) > 0.15))
    vis_pid = vision_signal.get("product_id")
    vis_pname = vision_signal.get("product_name") or vision_signal.get("class_name")
    vis_score = float(vision_signal.get("score") or vision_signal.get("confidence", 0.0))

    ocr_detected = bool(ocr_signal.get("detected") or (ocr_signal.get("extracted_text") and len(str(ocr_signal.get("extracted_text")).strip()) > 1))
    ocr_pid = ocr_signal.get("product_id")
    ocr_pname = ocr_signal.get("product_name")
    ocr_score = float(ocr_signal.get("score", 0.0))
    ocr_text_extracted = ocr_signal.get("extracted_text", "")
    ocr_kws = ocr_signal.get("matched_keywords", [])

    sim_detected = bool(similarity_signal.get("detected") or (similarity_signal.get("similarity", 0.0) > 0.30))
    sim_pid = similarity_signal.get("product_id")
    sim_pname = similarity_signal.get("product_name")
    sim_score = float(similarity_signal.get("score") or similarity_signal.get("similarity", 0.0))

    # Helper: Fetch product from DB if product_id is known
    all_pids = [p for p in [bc_pid, vis_pid, ocr_pid, sim_pid] if p]
    candidate_products: Dict[str, Dict[str, Any]] = {}
    if db is not None:
        for p_id in set(all_pids):
            p_obj = crud.get_product(db, product_id=p_id)
            if p_obj:
                candidate_products[p_id] = format_product_dict(p_obj)
    
    # ----------------------------------------------------
    # RULE 1: CONFLICT & MISMATCH DETECTION (Highest Priority)
    # ----------------------------------------------------
    conflicts = []

    # Conflict 1: Barcode product conflicts with Vision product
    if bc_pid and vis_pid and bc_pid != vis_pid and vis_score >= 0.60:
        vis_title = candidate_products.get(vis_pid, {}).get("name", vis_pname or vis_pid)
        bc_title = candidate_products.get(bc_pid, {}).get("name", bc_pname or bc_pid)
        conflicts.append(f"Barcode identifies '{bc_title}', but Vision identifies '{vis_title}' (conf: {vis_score:.2f})")

    # Conflict 2: Barcode product conflicts with OCR packaging text
    if bc_pid and ocr_pid and bc_pid != ocr_pid and ocr_score >= 0.50:
        ocr_title = candidate_products.get(ocr_pid, {}).get("name", ocr_pname or ocr_pid)
        bc_title = candidate_products.get(bc_pid, {}).get("name", bc_pname or bc_pid)
        conflicts.append(f"Barcode identifies '{bc_title}', but Packaging OCR identifies '{ocr_title}' (score: {ocr_score:.2f})")

    # Conflict 3: Barcode product conflicts with Visual Similarity (DINOv2)
    if bc_pid and sim_pid and bc_pid != sim_pid and sim_score >= 0.75:
        sim_title = candidate_products.get(sim_pid, {}).get("name", sim_pname or sim_pid)
        bc_title = candidate_products.get(bc_pid, {}).get("name", bc_pname or bc_pid)
        conflicts.append(f"Barcode identifies '{bc_title}', but Visual Similarity matches '{sim_title}' (sim: {sim_score:.2f})")

    # Conflict 4: Vision & OCR & Similarity strongly identify Product A, but Barcode scanned is unregistered or Product B
    if vis_pid and ocr_pid and vis_pid == ocr_pid and bc_pid and bc_pid != vis_pid:
        vis_title = candidate_products.get(vis_pid, {}).get("name", vis_pname or vis_pid)
        bc_title = candidate_products.get(bc_pid, {}).get("name", bc_pname or bc_pid)
        conflicts.append(f"Vision & OCR agree on '{vis_title}', which conflicts with Barcode '{bc_title}'")

    if conflicts:
        # Resolve target conflicting product for user display
        target_pid = bc_pid or ocr_pid or vis_pid or sim_pid
        target_prod = candidate_products.get(target_pid) if target_pid else None
        
        return {
            "status": "MISMATCH",
            "product_id": target_pid,
            "product_name": target_prod.get("name") if target_prod else (bc_pname or ocr_pname or vis_pname),
            "confidence": round(max(bc_score, ocr_score, vis_score, sim_score), 4),
            "signals": {
                "barcode": {
                    "detected": bc_detected,
                    "barcode": bc_val,
                    "product_id": bc_pid,
                    "product_name": candidate_products.get(bc_pid, {}).get("name", bc_pname),
                    "match": bool(bc_pid),
                    "score": bc_score
                },
                "vision": {
                    "detected": vis_detected,
                    "product_id": vis_pid,
                    "product_name": candidate_products.get(vis_pid, {}).get("name", vis_pname),
                    "confidence": vis_score,
                    "bbox": vision_signal.get("bbox"),
                    "match": bool(vis_pid),
                    "score": vis_score
                },
                "ocr": {
                    "detected": ocr_detected,
                    "extracted_text": ocr_text_extracted,
                    "normalized_text": ocr_signal.get("normalized_text", normalize_text(ocr_text_extracted)),
                    "product_id": ocr_pid,
                    "product_name": candidate_products.get(ocr_pid, {}).get("name", ocr_pname),
                    "matched_keywords": ocr_kws,
                    "match": bool(ocr_pid and ocr_score >= 0.50),
                    "score": ocr_score
                },
                "similarity": {
                    "detected": sim_detected,
                    "product_id": sim_pid,
                    "product_name": candidate_products.get(sim_pid, {}).get("name", sim_pname),
                    "similarity": sim_score,
                    "top2_similarity": similarity_signal.get("top2_similarity"),
                    "margin": similarity_signal.get("margin"),
                    "match": bool(sim_pid and sim_score >= 0.65),
                    "score": sim_score
                }
            },
            "reason": "; ".join(conflicts),
            "recommended_action": "REJECT",
            "product": target_prod
        }

    # ----------------------------------------------------
    # RULE 2: PRODUCT CANDIDATE SELECTION & WEIGHTED FUSION
    # ----------------------------------------------------
    # Determine the primary product candidate
    primary_pid = None
    if bc_pid:
        primary_pid = bc_pid
    elif ocr_pid and ocr_score >= 0.60:
        primary_pid = ocr_pid
    elif sim_pid and sim_score >= 0.65:
        primary_pid = sim_pid
    elif vis_pid and vis_score >= 0.60:
        primary_pid = vis_pid
    elif ocr_pid:
        primary_pid = ocr_pid
    elif sim_pid:
        primary_pid = sim_pid
    elif vis_pid:
        primary_pid = vis_pid

    if not primary_pid:
        # Check if unregistered barcode was scanned
        if bc_val:
            return {
                "status": "UNKNOWN",
                "product_id": None,
                "product_name": None,
                "confidence": 0.0,
                "signals": {
                    "barcode": {"detected": True, "barcode": bc_val, "product_id": None, "match": False, "score": 0.0},
                    "vision": {"detected": vis_detected, "product_id": None, "confidence": vis_score, "match": False, "score": 0.0},
                    "ocr": {"detected": ocr_detected, "extracted_text": ocr_text_extracted, "product_id": None, "match": False, "score": 0.0},
                    "similarity": {"detected": sim_detected, "product_id": None, "similarity": sim_score, "match": False, "score": 0.0}
                },
                "reason": f"Barcode '{bc_val}' not registered in KartMitra database.",
                "recommended_action": "SCAN_AGAIN",
                "product": None
            }

        return {
            "status": "UNKNOWN",
            "product_id": None,
            "product_name": None,
            "confidence": 0.0,
            "signals": {
                "barcode": {"detected": False, "barcode": None, "product_id": None, "match": False, "score": 0.0},
                "vision": {"detected": vis_detected, "product_id": None, "confidence": vis_score, "match": False, "score": 0.0},
                "ocr": {"detected": ocr_detected, "extracted_text": ocr_text_extracted, "product_id": None, "match": False, "score": 0.0},
                "similarity": {"detected": sim_detected, "product_id": None, "similarity": sim_score, "match": False, "score": 0.0}
            },
            "reason": "No registered product identified across Barcode, Vision, OCR, or Visual Similarity.",
            "recommended_action": "SCAN_AGAIN",
            "product": None
        }

    # Primary product identified: Compute signal scores towards primary_pid
    s_barcode = bc_score if (bc_pid == primary_pid) else 0.0
    s_vision = vis_score if (vis_pid == primary_pid) else (vis_score * 0.5 if (vis_detected and not vis_pid) else 0.0)
    s_ocr = ocr_score if (ocr_pid == primary_pid) else 0.0
    s_sim = sim_score if (sim_pid == primary_pid) else 0.0

    # Calculate weighted composite score
    total_weights = 0.0
    composite_score = 0.0

    if bc_detected:
        composite_score += s_barcode * w_barcode
        total_weights += w_barcode
    if vis_detected:
        composite_score += s_vision * w_vision
        total_weights += w_vision
    if ocr_detected:
        composite_score += s_ocr * w_ocr
        total_weights += w_ocr
    if sim_detected:
        composite_score += s_sim * w_sim
        total_weights += w_sim

    if total_weights > 0:
        normalized_confidence = round(composite_score / total_weights, 4)
    else:
        normalized_confidence = 0.0

    # Barcode-first priority: A valid registered barcode provides instant high confidence
    if bc_pid == primary_pid:
        if normalized_confidence < 0.85:
            # Barcode alone or barcode with light supporting signals
            final_confidence = max(0.95, normalized_confidence)
        else:
            final_confidence = normalized_confidence
    else:
        final_confidence = normalized_confidence

    primary_prod = candidate_products.get(primary_pid)
    prod_name = primary_prod.get("name") if primary_prod else (bc_pname or ocr_pname or vis_pname or sim_pname or f"Product {primary_pid}")

    # ----------------------------------------------------
    # RULE 3: STATE & DECISION CATEGORIZATION
    # ----------------------------------------------------
    status = "UNKNOWN"
    reason = ""
    rec_action = "SCAN_AGAIN"

    # CASE A: Barcode matched registered product
    if bc_pid == primary_pid:
        status = "MATCH"
        agreeing = ["Barcode"]
        if vis_pid == primary_pid: agreeing.append(f"Vision ({vis_score:.2f})")
        if ocr_pid == primary_pid: agreeing.append(f"OCR ({ocr_score:.2f})")
        if sim_pid == primary_pid: agreeing.append(f"Visual Similarity ({sim_score:.2f})")
        
        if len(agreeing) > 1:
            reason = f"Verified with high confidence: {', '.join(agreeing)} agree on '{prod_name}'."
        else:
            reason = f"Identified via registered barcode ({bc_val}) for '{prod_name}'."
        rec_action = "ADD_TO_CART"

    # CASE B: No barcode, but OCR + Vision / Similarity agree strongly
    elif (ocr_pid == primary_pid and (vis_pid == primary_pid or sim_pid == primary_pid)) and final_confidence >= match_th:
        status = "MATCH"
        agreeing = []
        if ocr_pid == primary_pid: agreeing.append(f"OCR text '{ocr_text_extracted[:25]}...'")
        if vis_pid == primary_pid: agreeing.append("YOLO Vision")
        if sim_pid == primary_pid: agreeing.append(f"DINOv2 Similarity ({sim_score:.2f})")
        reason = f"Multi-signal match without barcode: {', '.join(agreeing)} verified '{prod_name}'."
        rec_action = "ADD_TO_CART"

    # CASE C: Strong standalone OCR match
    elif ocr_pid == primary_pid and ocr_score >= 0.80:
        status = "MATCH"
        reason = f"Strong packaging OCR match for '{prod_name}' (score: {ocr_score:.2f}, keywords: {', '.join(ocr_kws[:3])})."
        rec_action = "ADD_TO_CART"

    # CASE D: Strong Visual Similarity match (DINOv2 + FAISS)
    elif sim_pid == primary_pid and sim_score >= cfg["similarity_match_threshold"]:
        status = "MATCH"
        reason = f"Visual reference similarity match for '{prod_name}' (similarity: {sim_score:.2f})."
        rec_action = "ADD_TO_CART"

    # CASE E: Review Threshold (Ambiguous or moderate signals)
    elif final_confidence >= review_th or (ocr_score >= 0.45) or (sim_score >= cfg["similarity_review_threshold"]):
        status = "REVIEW"
        reason = f"Moderate recognition signals for '{prod_name}' (confidence: {final_confidence:.2f}). Manual review or reposition recommended."
        rec_action = "MANUAL_REVIEW"

    # CASE F: Below review threshold -> UNKNOWN
    else:
        status = "UNKNOWN"
        reason = f"Weak recognition signals (confidence {final_confidence:.2f} < threshold {review_th:.2f})."
        rec_action = "SCAN_AGAIN"

    return {
        "status": status,
        "product_id": primary_pid if status in ("MATCH", "REVIEW") else None,
        "product_name": prod_name if status in ("MATCH", "REVIEW") else None,
        "confidence": final_confidence,
        "signals": {
            "barcode": {
                "detected": bc_detected,
                "barcode": bc_val,
                "product_id": bc_pid,
                "product_name": candidate_products.get(bc_pid, {}).get("name", bc_pname),
                "match": bool(bc_pid == primary_pid),
                "score": bc_score
            },
            "vision": {
                "detected": vis_detected,
                "product_id": vis_pid,
                "product_name": candidate_products.get(vis_pid, {}).get("name", vis_pname),
                "confidence": vis_score,
                "bbox": vision_signal.get("bbox"),
                "match": bool(vis_pid == primary_pid),
                "score": vis_score
            },
            "ocr": {
                "detected": ocr_detected,
                "extracted_text": ocr_text_extracted,
                "normalized_text": ocr_signal.get("normalized_text", normalize_text(ocr_text_extracted)),
                "product_id": ocr_pid,
                "product_name": candidate_products.get(ocr_pid, {}).get("name", ocr_pname),
                "matched_keywords": ocr_kws,
                "match": bool(ocr_pid == primary_pid),
                "score": ocr_score
            },
            "similarity": {
                "detected": sim_detected,
                "product_id": sim_pid,
                "product_name": candidate_products.get(sim_pid, {}).get("name", sim_pname),
                "similarity": sim_score,
                "top2_similarity": similarity_signal.get("top2_similarity"),
                "margin": similarity_signal.get("margin"),
                "match": bool(sim_pid == primary_pid),
                "score": sim_score
            }
        },
        "reason": reason,
        "recommended_action": rec_action,
        "product": primary_prod if status in ("MATCH", "REVIEW") else None
    }


def process_full_frame_multi_signal(
    image_bytes: bytes,
    db: Optional[Session] = None,
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes full multi-signal pipeline on raw camera frame:
    1. Barcode scanning (zxing-cpp)
    2. YOLO Object Detection & Crop Extraction
    3. Per-crop OCR text extraction & matching
    4. Per-crop DINOv2 visual embedding & FAISS search
    5. Multi-Signal Decision Engine per product crop
    6. Multi-product aggregation & Cart update
    """
    import cv2
    import numpy as np
    import zxingcpp
    from app.vision_service import extract_crops_and_detections
    from app.visual_embedding_service import generate_embeddings_from_images
    from app import visual_index_service

    if not image_bytes:
        return {
            "success": False,
            "status": "UNKNOWN",
            "error": "No image data provided",
            "total_detections": 0,
            "detections": [],
            "cart_summary": [],
            "frame_status": "NO_PRODUCT"
        }

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {
            "success": False,
            "status": "UNKNOWN",
            "error": "Invalid image format",
            "total_detections": 0,
            "detections": [],
            "cart_summary": [],
            "frame_status": "NO_PRODUCT"
        }

    img_h, img_w = img.shape[:2]
    all_db_products = crud.get_all_products_dict(db) if db is not None else []

    # 1. Barcode Scanning
    barcodes = []
    try:
        b_results = zxingcpp.read_barcodes(img)
        for b in b_results:
            b_txt = b.text.strip() if b.text else ""
            if b_txt:
                prod_obj = crud.get_product_by_barcode(db, barcode=b_txt) if db is not None else None
                barcodes.append({
                    "value": b_txt,
                    "barcode": b_txt,
                    "product_id": prod_obj.id if prod_obj else None,
                    "product_name": prod_obj.name if prod_obj else None,
                    "score": 1.0 if prod_obj else 0.0,
                    "detected": True
                })
    except Exception as e:
        print(f"[MultiSignal] Barcode scan error: {e}", flush=True)

    # 2. YOLO Object Detection & Crops
    det_data = extract_crops_and_detections(img)
    raw_detections = det_data.get("raw_detections", [])

    # If YOLO didn't find crops, fallback to full frame as single crop
    if not raw_detections:
        raw_detections = [{
            "detection_id": 1,
            "bbox": {"x1": 0, "y1": 0, "x2": img_w, "y2": img_h, "x": 0, "y": 0, "width": img_w, "height": img_h},
            "detection_confidence": 1.0,
            "yolo_class_id": 0,
            "yolo_class_name": "product",
            "crop_img": img,
            "is_too_small": False
        }]

    # 3. Batch Visual Embeddings (DINOv2)
    crop_images = [d["crop_img"] for d in raw_detections]
    embeddings = generate_embeddings_from_images(crop_images)

    processed_detections = []
    matched_count = 0
    mismatch_count = 0
    review_count = 0
    unknown_count = 0

    for idx, raw in enumerate(raw_detections):
        crop = raw["crop_img"]
        bbox = raw["bbox"]
        yolo_cls = raw["yolo_class_name"]
        yolo_conf = float(raw["detection_confidence"])

        # Signal 1: Barcode for this crop (use first barcode if only 1, or match)
        bc_sig = barcodes[0] if (barcodes and len(barcodes) == 1) else (barcodes[idx] if idx < len(barcodes) else {"detected": False})

        # Signal 2: Vision
        vis_sig = {
            "detected": yolo_conf > 0.15,
            "class_name": yolo_cls,
            "confidence": yolo_conf,
            "bbox": [bbox.get("x1", 0), bbox.get("y1", 0), bbox.get("x2", 0), bbox.get("y2", 0)],
            "score": yolo_conf
        }

        # Signal 3: OCR on Crop
        ocr_res = run_ocr(crop)
        ocr_match_res = match_ocr_text_against_database(ocr_res["raw_text"], all_db_products)
        best_ocr = ocr_match_res.get("best_match")
        ocr_sig = {
            "detected": bool(ocr_res["raw_text"]),
            "extracted_text": ocr_res["raw_text"],
            "normalized_text": ocr_res["normalized_text"],
            "product_id": best_ocr.get("product_id") if best_ocr else None,
            "product_name": best_ocr.get("product_name") if best_ocr else None,
            "matched_keywords": best_ocr.get("matched_keywords", []) if best_ocr else [],
            "score": best_ocr.get("score", 0.0) if best_ocr else 0.0
        }

        # Signal 4: Visual Similarity (DINOv2 + FAISS)
        emb_vec = embeddings[idx] if idx < len(embeddings) else None
        raw_sim_matches = visual_index_service.search_similar(emb_vec, top_k=5) if emb_vec is not None else []
        best_sim = raw_sim_matches[0] if raw_sim_matches else None
        top2_sim = raw_sim_matches[1]["similarity"] if len(raw_sim_matches) > 1 else None

        sim_sig = {
            "detected": bool(best_sim),
            "product_id": best_sim.get("product_id") if best_sim else None,
            "product_name": next((p["name"] for p in all_db_products if p["id"] == best_sim.get("product_id")), None) if best_sim else None,
            "similarity": float(best_sim.get("similarity", 0.0)) if best_sim else 0.0,
            "top2_similarity": float(top2_sim) if top2_sim is not None else None,
            "margin": round(float(best_sim.get("similarity", 0.0)) - float(top2_sim), 4) if (best_sim and top2_sim is not None) else None,
            "score": float(best_sim.get("similarity", 0.0)) if best_sim else 0.0
        }

        # FUSION
        decision = fuse_multi_signals(
            barcode_signal=bc_sig,
            vision_signal=vis_sig,
            ocr_signal=ocr_sig,
            similarity_signal=sim_sig,
            db=db
        )

        st = decision["status"]
        if st == "MATCH": matched_count += 1
        elif st == "MISMATCH": mismatch_count += 1
        elif st == "REVIEW": review_count += 1
        else: unknown_count += 1

        processed_detections.append({
            "detection_id": raw["detection_id"],
            "bbox": bbox,
            "status": decision["status"],
            "product_id": decision["product_id"],
            "product_name": decision["product_name"],
            "confidence": decision["confidence"],
            "signals": decision["signals"],
            "reason": decision["reason"],
            "recommended_action": decision["recommended_action"],
            "product": decision["product"]
        })

    # Aggregated Cart Summary
    cart_summary = []
    cart_groups: Dict[str, Dict[str, Any]] = {}
    for d in processed_detections:
        if d["status"] == "MATCH" and d["product_id"]:
            pid = d["product_id"]
            p_data = d["product"] or {}
            price = float(p_data.get("price", 0))
            weight = float(p_data.get("weight", 0.0))
            name = d["product_name"] or p_data.get("name", f"Product {pid}")

            if pid not in cart_groups:
                cart_groups[pid] = {
                    "product_id": pid,
                    "name": name,
                    "quantity": 1,
                    "unit_price": price,
                    "total_price": price,
                    "unit_weight": weight,
                    "total_expected_weight": weight,
                    "barcode": p_data.get("barcode", ""),
                    "status": "VERIFIED"
                }
            else:
                cart_groups[pid]["quantity"] += 1
                q = cart_groups[pid]["quantity"]
                cart_groups[pid]["total_price"] = round(price * q, 2)
                cart_groups[pid]["total_expected_weight"] = round(weight * q, 4)

    cart_summary = list(cart_groups.values())
    total_cart_price = round(sum(i["total_price"] for i in cart_summary), 2)
    total_cart_weight = round(sum(i["total_expected_weight"] for i in cart_summary), 4)

    # Determine frame status
    if mismatch_count > 0:
        frame_status = "MISMATCH"
    elif matched_count > 0 and (matched_count == len(processed_detections)):
        frame_status = "MATCH"
    elif review_count > 0:
        frame_status = "REVIEW"
    elif matched_count > 0:
        frame_status = "REVIEW"
    else:
        frame_status = "UNKNOWN"

    primary_res = processed_detections[0] if processed_detections else None

    return {
        "success": True,
        "status": frame_status,
        "product_id": primary_res["product_id"] if primary_res else None,
        "product_name": primary_res["product_name"] if primary_res else None,
        "confidence": primary_res["confidence"] if primary_res else 0.0,
        "signals": primary_res["signals"] if primary_res else {},
        "reason": primary_res["reason"] if primary_res else "No products detected",
        "recommended_action": primary_res["recommended_action"] if primary_res else "SCAN_AGAIN",
        "product": primary_res["product"] if primary_res else None,
        "total_detections": len(processed_detections),
        "detections": processed_detections,
        "cart_summary": cart_summary,
        "cart": {
            "total_items": sum(i["quantity"] for i in cart_summary),
            "total_price": total_cart_price,
            "expected_weight": total_cart_weight
        },
        "frame_status": frame_status
    }
