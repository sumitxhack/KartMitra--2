import os
import cv2
import uuid
import time
from pathlib import Path
from typing import Optional, Dict, Any

from app import config

TRAINING_SAMPLES_DIR = config.BASE_DIR / "training_samples"
DIRS = {
    "UNKNOWN": TRAINING_SAMPLES_DIR / "unknown",
    "REVIEW": TRAINING_SAMPLES_DIR / "review",
    "MISMATCH": TRAINING_SAMPLES_DIR / "mismatch",
    "MATCH": TRAINING_SAMPLES_DIR / "verified",
    "VERIFIED": TRAINING_SAMPLES_DIR / "verified",
}

for d in DIRS.values():
    d.mkdir(parents=True, exist_ok=True)


def save_candidate_training_sample(
    image_bytes: bytes,
    status: str,
    product_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    """
    Saves an ambiguous, mismatched, or verified product image frame as a candidate training sample.
    These candidate files are stored for human inspection and active learning dataset fine-tuning.
    """
    if not image_bytes:
        return None

    status_key = status.upper() if status else "UNKNOWN"
    target_dir = DIRS.get(status_key, DIRS["UNKNOWN"])
    
    timestamp = int(time.time())
    unique_id = uuid.uuid4().hex[:8]
    p_tag = f"prod_{product_id}" if product_id else "unknown_prod"
    filename = f"{status_key.lower()}_{p_tag}_{timestamp}_{unique_id}.jpg"
    file_path = target_dir / filename

    try:
        with open(file_path, "wb") as f:
            f.write(image_bytes)

        # Also write a sidecar JSON metadata file if metadata provided
        if metadata:
            meta_path = target_dir / f"{status_key.lower()}_{p_tag}_{timestamp}_{unique_id}.json"
            import json
            with open(meta_path, "w", encoding="utf-8") as mf:
                json.dump({
                    "image_file": filename,
                    "status": status_key,
                    "product_id": product_id,
                    "timestamp": timestamp,
                    "metadata": metadata
                }, mf, indent=2)

        return str(file_path)
    except Exception as e:
        print(f"[Training Collector] Failed to save sample: {e}", flush=True)
        return None
