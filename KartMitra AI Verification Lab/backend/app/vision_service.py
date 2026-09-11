import os
import cv2
import numpy as np
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.config import (
    MODEL_PATH,
    CONFIDENCE_THRESHOLD,
    IOU_THRESHOLD,
    VISION_BBOX_PADDING,
    MAX_MULTI_DETECTIONS,
    MIN_CROP_WIDTH,
    MIN_CROP_HEIGHT
)
from app import crud

_yolo_model: Optional[Any] = None
_yolo_error: Optional[str] = None
_active_class_mapping: Dict[int, Dict[str, str]] = {}

class DummyYOLOModel:
    """Fallback dummy YOLO model when ultralytics or weights are unavailable."""
    def __init__(self, error: Optional[str] = None):
        self.names = {0: "object"}
        self.error = error or "YOLO model not loaded"
        self.is_ready = False
        
    def predict(self, source, conf=0.25, iou=0.45, verbose=False):
        return []

def is_yolo_model_ready() -> bool:
    """Returns True if a real YOLO model instance is loaded and ready."""
    m = get_yolo_model()
    return m is not None and not isinstance(m, DummyYOLOModel)

def get_yolo_error() -> Optional[str]:
    """Returns the last YOLO loading/runtime error if any."""
    return _yolo_error

def reload_active_yolo_model() -> Any:
    """Explicitly reloads active fine-tuned YOLO model from active version weights."""
    global _yolo_model, _yolo_error, _active_class_mapping
    _yolo_model = None
    _yolo_error = None
    return get_yolo_model()

def get_yolo_model() -> Any:
    """
    Step 16AG: Singleton getter for YOLO model instance.
    Switches between BASE model and active fine-tuned KARTMITRA model based on VISION_MODEL_MODE and active registry model.
    """
    global _yolo_model, _yolo_error, _active_class_mapping
    if _yolo_model is None:
        try:
            from ultralytics import YOLO
            from app.config import VISION_MODEL_MODE
            from app.training_service import get_active_model_version
            from app.dataset_service import load_class_mapping

            ver_name, active_path = get_active_model_version()

            # Determine whether to use fine-tuned KartMitra model or BASE model
            if (VISION_MODEL_MODE == "KARTMITRA_TRAINED" or active_path is not None) and active_path and active_path.exists():
                model_path = str(active_path)
                print(f"[YOLO Vision Service] Loading fine-tuned KartMitra YOLO model ({ver_name}) from {model_path}...", flush=True)
            else:
                model_path = MODEL_PATH
                print(f"[YOLO Vision Service] Loading base YOLO model from {model_path}...", flush=True)

            try:
                _yolo_model = YOLO(model_path)
            except Exception as fe:
                # If fine-tuned checkpoint is missing or corrupted, gracefully fall back to base model
                if str(model_path) != str(MODEL_PATH):
                    print(f"[YOLO Vision Service] Failed to load fine-tuned model ({fe}). Falling back to base model '{MODEL_PATH}'...", flush=True)
                    model_path = MODEL_PATH
                    _yolo_model = YOLO(model_path)
                else:
                    raise fe

            # Load class mapping if active
            raw_map = load_class_mapping()
            _active_class_mapping = {int(k): v for k, v in raw_map.items()}

            _yolo_error = None
            print("[YOLO Vision Service] Model loaded successfully.", flush=True)
        except Exception as e:
            _yolo_error = str(e)
            print(f"[YOLO Vision Service] Failed to initialize ultralytics YOLO model ({e}). Using visual feature matcher fallback.", flush=True)
            _yolo_model = DummyYOLOModel(error=str(e))
    return _yolo_model



def find_salient_object_regions(
    img: np.ndarray,
    existing_boxes: List[List[float]],
    min_area: int = 1500
) -> List[Dict[str, Any]]:
    """
    OpenCV contour-based salient object region detector.
    Locates and separates individual physical objects/packages on surfaces even when placed side-by-side.
    """
    img_h, img_w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # 1. Edge detection with small kernel (3,3) and 1 iteration so items don't merge
    edges = cv2.Canny(blurred, 30, 120)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dilated = cv2.dilate(edges, kernel, iterations=1)

    # Use RETR_LIST to capture distinct internal/external object boundaries
    contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    raw_candidates = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > (img_h * img_w * 0.70):
            continue

        x, y, w, h = cv2.boundingRect(cnt)
        if w < MIN_CROP_WIDTH * 2 or h < MIN_CROP_HEIGHT * 2:
            continue

        raw_candidates.append([float(x), float(y), float(x + w), float(y + h)])

    # 2. Containment filtering to merge inner sub-contours of the SAME item while keeping side-by-side items SEPARATE
    merged_boxes = []
    raw_candidates.sort(key=lambda b: (b[2]-b[0])*(b[3]-b[1]), reverse=True)

    for box in raw_candidates:
        x1, y1, x2, y2 = box
        bw, bh = x2 - x1, y2 - y1
        box_area = bw * bh

        is_inside_existing = False
        for mbox in merged_boxes:
            mx1, my1, mx2, my2 = mbox
            inter_x = max(0, min(x2, mx2) - max(x1, mx1))
            inter_y = max(0, min(y2, my2) - max(y1, my1))
            inter_area = inter_x * inter_y

            # If box is >60% contained inside a larger box, drop it as an inner detail
            if inter_area / max(1, box_area) > 0.60:
                is_inside_existing = True
                break

        if not is_inside_existing:
            merged_boxes.append(box)

    # 3. Check IoU against existing YOLO detections
    additional_boxes = []
    for box in merged_boxes:
        x1, y1, x2, y2 = box
        bw, bh = x2 - x1, y2 - y1

        overlaps = False
        for ebox in existing_boxes:
            ex1, ey1, ex2, ey2 = ebox
            inter_x = max(0, min(x2, ex2) - max(x1, ex1))
            inter_y = max(0, min(y2, ey2) - max(y1, ey1))
            inter_area = inter_x * inter_y
            if inter_area / max(1, bw * bh) > 0.35 or inter_area / max(1, (ex2 - ex1) * (ey2 - ey1)) > 0.35:
                overlaps = True
                break

        if not overlaps:
            additional_boxes.append({
                "xyxy": [x1, y1, x2, y2],
                "confidence": 0.85,
                "cls_id": 0,
                "class_name": "package"
            })

    return additional_boxes



def extract_crops_and_detections(
    img: np.ndarray,
    conf_threshold: float = CONFIDENCE_THRESHOLD,
    iou_threshold: float = IOU_THRESHOLD,
    padding: float = VISION_BBOX_PADDING,
    max_detections: int = MAX_MULTI_DETECTIONS
) -> Dict[str, Any]:
    """
    Step 15A & 15B: Runs hybrid YOLO + OpenCV contour object detection on image,
    extracts N bounding boxes up to max_detections, applies 5% padding,
    clips coordinates to frame boundaries, and crops image regions.
    """
    img_h, img_w = img.shape[:2]
    model = get_yolo_model()
    
    # Use low confidence threshold (0.08) for maximum multi-object sensitivity
    effective_conf = min(conf_threshold, 0.08)
    results = model.predict(source=img, conf=effective_conf, iou=iou_threshold, verbose=False)

    first_result = results[0] if (results and len(results) > 0) else None
    boxes = first_result.boxes if first_result is not None else None

    parsed_boxes = []
    existing_xyxy = []

    if boxes is not None and len(boxes) > 0:
        names_dict = first_result.names if hasattr(first_result, "names") else model.names

        for idx, box in enumerate(boxes):
            raw_xyxy = box.xyxy[0]
            xyxy = raw_xyxy.tolist() if hasattr(raw_xyxy, "tolist") else list(raw_xyxy)
            conf = float(box.conf[0].item()) if hasattr(box.conf[0], "item") else float(box.conf[0])
            cls_id = int(box.cls[0].item()) if hasattr(box.cls[0], "item") else int(box.cls[0])
            class_name = names_dict.get(cls_id, f"class_{cls_id}")

            parsed_boxes.append({
                "xyxy": xyxy,
                "confidence": conf,
                "cls_id": cls_id,
                "class_name": class_name
            })
            existing_xyxy.append(xyxy)

    # Contour region proposal fallback only if YOLO returns no bounding boxes
    if not parsed_boxes:
        salient_boxes = find_salient_object_regions(img, existing_xyxy)
        parsed_boxes.extend(salient_boxes)


    if not parsed_boxes:
        return {
            "success": True,
            "raw_detections": [],
            "detections_truncated": False,
            "image_width": img_w,
            "image_height": img_h
        }

    # Step 15V: Truncate to highest confidence detections if exceeding max_detections
    detections_truncated = False
    if len(parsed_boxes) > max_detections:
        parsed_boxes.sort(key=lambda b: b["confidence"], reverse=True)
        parsed_boxes = parsed_boxes[:max_detections]
        detections_truncated = True


    raw_detections = []
    for det_idx, item in enumerate(parsed_boxes, start=1):
        x1, y1, x2, y2 = item["xyxy"]
        bw = x2 - x1
        bh = y2 - y1

        # Apply configurable padding (default 5%)
        pad_x = bw * padding
        pad_y = bh * padding

        px1 = max(0, int(round(x1 - pad_x)))
        py1 = max(0, int(round(y1 - pad_y)))
        px2 = min(img_w, int(round(x2 + pad_x)))
        py2 = min(img_h, int(round(y2 + pad_y)))

        crop_w = max(1, px2 - px1)
        crop_h = max(1, py2 - py1)

        is_too_small = crop_w < MIN_CROP_WIDTH or crop_h < MIN_CROP_HEIGHT
        crop_img = img[py1:py2, px1:px2] if not is_too_small else np.zeros((1, 1, 3), dtype=np.uint8)

        raw_detections.append({
            "detection_id": det_idx,
            "bbox": {
                "x1": px1,
                "y1": py1,
                "x2": px2,
                "y2": py2,
                "x": px1,
                "y": py1,
                "width": crop_w,
                "height": crop_h
            },
            "detection_confidence": round(item["confidence"], 4),
            "yolo_class_id": item["cls_id"],
            "yolo_class_name": item["class_name"],
            "crop_img": crop_img,
            "is_too_small": is_too_small
        })

    return {
        "success": True,
        "raw_detections": raw_detections,
        "detections_truncated": detections_truncated,
        "image_width": img_w,
        "image_height": img_h
    }


def detect_products_from_bytes(
    image_bytes: bytes,
    db: Optional[Session] = None,
    conf_threshold: float = CONFIDENCE_THRESHOLD,
    iou_threshold: float = IOU_THRESHOLD
) -> Dict[str, Any]:
    """
    Preprocesses camera/uploaded image bytes, runs YOLO object detection,
    and maps detected objects to registered PostgreSQL KartMitra products.
    """
    if not image_bytes:
        return {"success": False, "error": "Empty image data provided"}

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {"success": False, "error": "Invalid or unreadable image file format"}

    try:
        det_data = extract_crops_and_detections(img, conf_threshold=conf_threshold, iou_threshold=iou_threshold)
    except Exception as e:
        print(f"[YOLO Vision Service] Failed to execute YOLO detection: {e}", flush=True)
        return {"success": False, "error": f"Failed to load YOLO model: {str(e)}"}

    raw_dets = det_data.get("raw_detections", [])

    if not raw_dets:
        if db is not None:
            try:
                from app.feature_matcher import match_crop_to_db_products
                matched_prod, matched_score, _ = match_crop_to_db_products(img, db)
                if matched_prod is not None:
                    h, w = img.shape[:2]
                    return {
                        "success": True,
                        "detections": [{
                            "detection_id": 1,
                            "product_id": matched_prod.id,
                            "name": matched_prod.name,
                            "confidence": round(matched_score, 4),
                            "is_low_confidence": False,
                            "is_unknown": False,
                            "bounding_box": {"x": 0, "y": 0, "width": w, "height": h}
                        }]
                    }
            except Exception as fe:
                print(f"[Vision Service] Full-frame feature match exception: {fe}", flush=True)
        return {"success": True, "detections": []}

    detections: List[Dict[str, Any]] = []

    for raw in raw_dets:
        box_x = raw["bbox"]["x1"]
        box_y = raw["bbox"]["y1"]
        box_width = raw["bbox"]["width"]
        box_height = raw["bbox"]["height"]
        cls_id = raw.get("yolo_class_id", 0)
        conf = raw["detection_confidence"]
        class_name = raw["yolo_class_name"]
        crop_img = raw["crop_img"]

        product_id = None
        product_name = None
        is_unknown = True

        # 1. Check explicit dataset class mapping (Step 16J)
        from app.dataset_service import load_class_mapping
        cmap = load_class_mapping()
        if str(cls_id) in cmap:
            info = cmap[str(cls_id)]
            product_id = info.get("product_id")
            product_name = info.get("name")
            is_unknown = False

        if is_unknown and db is not None and crop_img.size > 0 and not raw.get("is_too_small"):
            try:
                from app.feature_matcher import match_crop_to_db_products
                matched_prod, matched_score, _ = match_crop_to_db_products(crop_img, db)
                if matched_prod is not None:
                    product_id = matched_prod.id
                    product_name = matched_prod.name
                    is_unknown = False
                    conf = max(conf, float(matched_score))
            except Exception as fe:
                print(f"[Vision Service] Bounding box feature match exception: {fe}", flush=True)


        if is_unknown:
            db_product = None
            if db is not None:
                db_product = crud.find_registered_product_for_class(db, class_name)

            if db_product:
                product_id = db_product.id
                product_name = db_product.name
                is_unknown = False
            else:
                try:
                    from db import find_registered_product_for_class_raw
                    raw_prod = find_registered_product_for_class_raw(class_name)
                    if raw_prod:
                        product_id = raw_prod["id"]
                        product_name = raw_prod["name"]
                        is_unknown = False
                    else:
                        product_id = None
                        product_name = f"Unknown ({class_name.title()})"
                        is_unknown = True
                except Exception:
                    product_id = None
                    product_name = f"Unknown ({class_name.title()})"
                    is_unknown = True

        is_low_confidence = bool(conf < conf_threshold)

        detections.append({
            "detection_id": raw["detection_id"],
            "product_id": product_id,
            "name": product_name,
            "confidence": round(conf, 4),
            "is_low_confidence": is_low_confidence,
            "is_unknown": is_unknown,
            "bounding_box": {
                "x": box_x,
                "y": box_y,
                "width": box_width,
                "height": box_height
            }
        })

    return {
        "success": True,
        "detections": detections,
        "detections_truncated": det_data.get("detections_truncated", False)
    }

