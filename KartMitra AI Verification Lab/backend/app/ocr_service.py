import re
import cv2
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from rapidfuzz import fuzz, utils as fuzz_utils

# Lazy singleton OCR instance to avoid reloading models on every call
_ocr_instance = None
_ocr_error: Optional[str] = None


def is_ocr_ready() -> bool:
    """Returns True if RapidOCR engine is initialized and ready."""
    return get_ocr_engine() is not None


def get_ocr_error() -> Optional[str]:
    """Returns the last OCR initialization/inference error if any."""
    return _ocr_error


def get_ocr_engine():
    global _ocr_instance, _ocr_error
    if _ocr_instance is None and _ocr_error is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _ocr_instance = RapidOCR()
            _ocr_error = None
        except Exception as e:
            _ocr_error = str(e)
            print(f"[OCR Service] Warning: Failed to initialize RapidOCR: {e}", flush=True)
            _ocr_instance = None
    return _ocr_instance


# Common OCR typo / character substitution replacements
OCR_CHAR_REPLACEMENTS = {
    r"\bM1LK\b": "MILK",
    r"\bM!LK\b": "MILK",
    r"\bMI1K\b": "MILK",
    r"\bTAAZA\b": "TAAZA",
    r"\bTAZA\b": "TAAZA",
    r"\bAMV1L\b": "AMUL",
    r"\bAMVL\b": "AMUL",
    r"\bAMU1\b": "AMUL",
    r"\bAMULL\b": "AMUL",
    r"\bMAGG1\b": "MAGGI",
    r"\bMAGG!\b": "MAGGI",
    r"\bNOODL3S\b": "NOODLES",
    r"\bBR3AD\b": "BREAD",
    r"\bBRITAN1A\b": "BRITANNIA",
    r"\bBRITANNA\b": "BRITANNIA",
    r"\bPARL3\b": "PARLE",
    r"\bPARL-E\b": "PARLE",
    r"\bB1SCUIT\b": "BISCUIT",
    r"\bB1SCUITS\b": "BISCUITS",
    r"\bL1TRE\b": "LITRE",
    r"\bL1TER\b": "LITRE",
    r"\bLTR\b": "LITRE",
    r"\b1L\b": "1 LITRE",
    r"\b1 L\b": "1 LITRE",
    r"\b500G\b": "500 GRAM",
    r"\b1KG\b": "1 KG",
}

# Stopwords to remove from generic packaging text if needed
PACKAGING_STOPWORDS = {
    "net", "qty", "quantity", "mfg", "exp", "batch", "no", "mrp", "incl", "taxes",
    "all", "of", "pkd", "best", "before", "months", "from", "date", "fssai", "lic",
    "customer", "care", "feedback", "email", "address", "call", "toll", "free",
    "keep", "in", "cool", "dry", "place", "store", "away", "direct", "sunlight"
}


def preprocess_image_for_ocr(img: np.ndarray) -> np.ndarray:
    """
    Enhances contrast, normalizes illumination, and optimizes image crop for OCR reading.
    """
    if img is None or img.size == 0:
        return img

    h, w = img.shape[:2]
    # Upscale small crops for better text detection
    if min(h, w) < 200:
        scale = max(2.0, 300.0 / max(1, min(h, w)))
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

    # Convert to grayscale
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()

    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Convert back to 3-channel for RapidOCR compatibility
    enhanced_bgr = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
    return enhanced_bgr


def normalize_text(text: str) -> str:
    """
    Normalizes packaging text by:
    1. Converting to uppercase for uniform comparison
    2. Replacing punctuation with spaces
    3. Normalizing units & common OCR typos
    4. Removing excessive whitespace
    """
    if not text:
        return ""

    # Uppercase
    cleaned = text.upper()

    # Common OCR typo corrections
    for pattern, replacement in OCR_CHAR_REPLACEMENTS.items():
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)

    # Replace special punctuation with whitespace (keep alphanumeric)
    cleaned = re.sub(r"[^A-Z0-9\s]", " ", cleaned)

    # Collapse multiple whitespaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    return cleaned


def extract_keywords_from_text(text: str) -> List[str]:
    """
    Extracts informative keywords from normalized text, filtering out common noise words.
    """
    words = normalize_text(text).lower().split()
    return [w for w in words if len(w) > 1 and w not in PACKAGING_STOPWORDS]


def run_ocr(
    image: np.ndarray,
    preprocess: bool = True
) -> Dict[str, Any]:
    """
    Runs RapidOCR on an image/crop.
    Returns:
    {
        "raw_text": "...",
        "normalized_text": "...",
        "boxes": [...],
        "confidence": float,
        "words": [...]
    }
    """
    if image is None or image.size == 0:
        return {
            "raw_text": "",
            "normalized_text": "",
            "boxes": [],
            "confidence": 0.0,
            "words": []
        }

    ocr = get_ocr_engine()
    if ocr is None:
        err_msg = f"OCR engine not available: {_ocr_error or 'RapidOCR initialization failed'}"
        return {
            "status": "AI_NOT_READY",
            "raw_text": "",
            "normalized_text": "",
            "boxes": [],
            "confidence": 0.0,
            "words": [],
            "error": err_msg
        }

    processed_img = preprocess_image_for_ocr(image) if preprocess else image

    try:
        results, _ = ocr(processed_img)
    except Exception as e:
        print(f"[OCR Service] OCR inference error: {e}", flush=True)
        results = None

    if not results:
        # Retry with original image without preprocessing if CLAHE over-contrasted
        if preprocess:
            try:
                results, _ = ocr(image)
            except Exception:
                results = None

    if not results:
        return {
            "raw_text": "",
            "normalized_text": "",
            "boxes": [],
            "confidence": 0.0,
            "words": []
        }

    extracted_lines = []
    boxes = []
    confidences = []

    for item in results:
        # item structure in RapidOCR: [box_points, text, confidence]
        if len(item) >= 3:
            box, txt, conf = item[0], item[1], float(item[2])
            if txt and txt.strip():
                extracted_lines.append(txt.strip())
                boxes.append(box)
                confidences.append(conf)

    raw_text = " ".join(extracted_lines)
    norm_text = normalize_text(raw_text)
    avg_conf = float(np.mean(confidences)) if confidences else 0.0
    words = extract_keywords_from_text(norm_text)

    return {
        "raw_text": raw_text,
        "normalized_text": norm_text,
        "boxes": boxes,
        "confidence": round(avg_conf, 4),
        "words": words
    }


def compute_product_text_similarity(
    extracted_text: str,
    product: Dict[str, Any]
) -> Tuple[float, List[str], str]:
    """
    Computes fuzzy match similarity between OCR extracted packaging text and a registered product.
    Checks:
    1. Product name fuzzy token set ratio
    2. Packaging keywords match percentage
    3. Category match
    4. Expected OCR text match

    Returns: (score: float 0.0-1.0, matched_keywords: List[str], reason: str)
    """
    if not extracted_text or not product:
        return 0.0, [], "No text or product provided"

    norm_extracted = normalize_text(extracted_text)
    extracted_words = set(extract_keywords_from_text(norm_extracted))

    prod_name = normalize_text(product.get("name") or "")
    prod_category = normalize_text(product.get("category") or "")
    prod_desc = normalize_text(product.get("description") or "")
    prod_ocr_text = normalize_text(product.get("ocr_text") or "")
    
    # Extract keywords list
    keywords_raw = product.get("keywords") or []
    if isinstance(keywords_raw, str):
        try:
            import json
            keywords_list = json.loads(keywords_raw)
        except Exception:
            keywords_list = [k.strip() for k in keywords_raw.split(",") if k.strip()]
    elif isinstance(keywords_raw, list):
        keywords_list = keywords_raw
    else:
        keywords_list = []

    # Clean product keywords
    clean_keywords = [normalize_text(k) for k in keywords_list if k]
    if not clean_keywords and prod_name:
        clean_keywords = [w for w in prod_name.split() if len(w) > 2]

    # 1. Product Name Fuzzy Token Match
    name_score = fuzz.token_set_ratio(prod_name, norm_extracted) / 100.0 if prod_name else 0.0
    partial_name_score = fuzz.partial_ratio(prod_name, norm_extracted) / 100.0 if prod_name else 0.0
    name_words = [w for w in prod_name.split() if len(w) > 2]
    contained_words = [w for w in name_words if w in norm_extracted]
    contained_ratio = len(contained_words) / max(1, len(name_words)) if name_words else 0.0
    best_name_score = max(name_score, partial_name_score * 0.90, contained_ratio * 0.95)

    # 2. Keywords Matching
    matched_keywords = []
    if clean_keywords:
        for kw in clean_keywords:
            kw_norm = normalize_text(kw)
            if not kw_norm:
                continue
            # Check direct substring or word containment
            if kw_norm in norm_extracted or any(fuzz.ratio(kw_norm, ew) >= 85 for ew in extracted_words):
                matched_keywords.append(kw)
            elif fuzz.partial_ratio(kw_norm, norm_extracted) >= 88:
                matched_keywords.append(kw)
        
        keyword_score = len(matched_keywords) / max(1, len(clean_keywords))
    else:
        keyword_score = best_name_score

    # 3. Expected OCR Reference Text Match (if configured)
    expected_ocr_score = 0.0
    if prod_ocr_text:
        expected_ocr_score = fuzz.token_set_ratio(prod_ocr_text, norm_extracted) / 100.0

    # 4. Category Bonus
    category_bonus = 0.0
    if prod_category and (prod_category in norm_extracted or any(fuzz.ratio(prod_category, ew) >= 85 for ew in extracted_words)):
        category_bonus = 0.05

    # Combined OCR matching score
    combined_score = (
        best_name_score * 0.45 +
        keyword_score * 0.35 +
        expected_ocr_score * 0.15 +
        category_bonus
    )
    combined_score = min(1.0, max(0.0, combined_score))

    reason = (
        f"OCR matched '{prod_name}' with score {combined_score:.2f} "
        f"({len(matched_keywords)}/{len(clean_keywords)} keywords matched: {', '.join(matched_keywords[:3])})"
    )

    return round(combined_score, 4), matched_keywords, reason


def match_ocr_text_against_database(
    extracted_text: str,
    products: List[Dict[str, Any]],
    min_confidence: float = 0.40
) -> Dict[str, Any]:
    """
    Evaluates OCR extracted text against all registered products in the database.
    Returns the top candidate and all candidates sorted by similarity score.
    """
    if not extracted_text or not products:
        return {
            "matched": False,
            "best_match": None,
            "candidates": [],
            "extracted_text": extracted_text,
            "normalized_text": normalize_text(extracted_text)
        }

    candidates = []
    for prod in products:
        score, matched_kws, reason = compute_product_text_similarity(extracted_text, prod)
        if score >= min_confidence:
            candidates.append({
                "product_id": prod.get("id"),
                "product_name": prod.get("name"),
                "barcode": prod.get("barcode"),
                "score": score,
                "matched_keywords": matched_kws,
                "reason": reason,
                "product": prod
            })

    candidates.sort(key=lambda c: c["score"], reverse=True)

    best_match = candidates[0] if candidates else None
    is_matched = best_match is not None and best_match["score"] >= 0.65

    return {
        "matched": is_matched,
        "best_match": best_match,
        "candidates": candidates[:5],
        "extracted_text": extracted_text,
        "normalized_text": normalize_text(extracted_text)
    }
