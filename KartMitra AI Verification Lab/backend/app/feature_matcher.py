import os
import cv2
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from app import models, crud
from app.config import BASE_DIR

# Feature matching parameters
MATCH_SCORE_THRESHOLD = 0.30  # Minimum similarity score required to declare a visual match

def resolve_image_path(rel_path: str) -> Optional[Path]:
    """
    Resolves relative or absolute image path stored in database to absolute filesystem Path.
    Handles /uploads/products/..., uploads/products/..., static/uploads/..., etc.
    """
    if not rel_path:
        return None
        
    p = Path(rel_path)
    if p.is_absolute() and p.exists():
        return p

    clean_path = rel_path.lstrip("/").lstrip("\\")
    
    # Try common directory bases in backend
    candidates = [
        BASE_DIR / clean_path,
        BASE_DIR / "uploads" / clean_path.replace("uploads/", ""),
        BASE_DIR / "static" / clean_path.replace("static/", ""),
        BASE_DIR.parent / clean_path,
    ]
    
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate
            
    return None


def extract_features(img: np.ndarray) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
    """
    Extracts ORB descriptors and normalized HSV color histogram from an OpenCV BGR image.
    Returns (descriptors, histogram).
    """
    if img is None or img.size == 0:
        return None, None

    # 1. ORB Descriptors
    orb = cv2.ORB_create(nfeatures=500)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    _, descriptors = orb.detectAndCompute(gray, None)

    # 2. HSV Color Histogram
    if len(img.shape) == 3:
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1], None, [30, 32], [0, 180, 0, 256])
        cv2.normalize(hist, hist, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
    else:
        hist = None

    return descriptors, hist


def compute_visual_similarity(
    query_des: Optional[np.ndarray],
    query_hist: Optional[np.ndarray],
    ref_des: Optional[np.ndarray],
    ref_hist: Optional[np.ndarray]
) -> float:
    """
    Computes a combined similarity score [0.0 to 1.0] between query image and reference image.
    Uses ORB descriptor matching and HSV color histogram correlation.
    """
    scores = []
    weights = []

    # 1. ORB Feature Matching
    if query_des is not None and ref_des is not None and len(query_des) > 0 and len(ref_des) > 0:
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        try:
            matches = bf.match(query_des, ref_des)
            # Filter matches by distance
            good_matches = [m for m in matches if m.distance < 65]
            max_des_len = max(len(query_des), len(ref_des))
            orb_score = len(good_matches) / float(max_des_len) if max_des_len > 0 else 0.0
            orb_score = min(1.0, orb_score * 2.0)  # Scale up
            scores.append(orb_score)
            weights.append(0.6)
        except Exception:
            pass

    # 2. Color Histogram Correlation
    if query_hist is not None and ref_hist is not None:
        try:
            corr = cv2.compareHist(query_hist, ref_hist, cv2.HISTCMP_CORREL)
            hist_score = max(0.0, float(corr))
            scores.append(hist_score)
            weights.append(0.4)
        except Exception:
            pass

    if not scores or sum(weights) == 0:
        return 0.0

    weighted_score = sum(s * w for s, w in zip(scores, weights)) / sum(weights)
    return round(float(weighted_score), 4)


def match_crop_to_db_products(
    crop_img: np.ndarray,
    db: Session,
    match_threshold: float = MATCH_SCORE_THRESHOLD
) -> Tuple[Optional[models.Product], float, Optional[str]]:
    """
    Visually compares a cropped object image against all registered ProductImages in the database.
    Returns (best_matched_product, confidence_score, matched_image_path).
    """
    if crop_img is None or crop_img.size == 0 or db is None:
        return None, 0.0, None

    query_des, query_hist = extract_features(crop_img)
    if query_des is None and query_hist is None:
        return None, 0.0, None

    # Fetch all registered products with their images
    products = db.query(models.Product).all()
    if not products:
        return None, 0.0, None

    best_product: Optional[models.Product] = None
    best_score: float = 0.0
    best_image_path: Optional[str] = None

    for product in products:
        if not product.images:
            continue

        product_best_score = 0.0
        product_best_img_path = None

        for prod_img in product.images:
            file_path = resolve_image_path(prod_img.image_path)
            if not file_path:
                continue

            ref_bgr = cv2.imread(str(file_path))
            if ref_bgr is None or ref_bgr.size == 0:
                continue

            ref_des, ref_hist = extract_features(ref_bgr)
            sim_score = compute_visual_similarity(query_des, query_hist, ref_des, ref_hist)

            if sim_score > product_best_score:
                product_best_score = sim_score
                product_best_img_path = prod_img.image_path

        if product_best_score > best_score:
            best_score = product_best_score
            best_product = product
            best_image_path = product_best_img_path

    if best_score >= match_threshold and best_product is not None:
        return best_product, best_score, best_image_path

    return None, best_score, best_image_path
