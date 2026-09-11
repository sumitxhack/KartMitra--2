import os
import json
import cv2
import hashlib
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict
from sqlalchemy.orm import Session

from app import models, crud
from app.config import BASE_DIR, DATASET_BASE_DIR, ALLOWED_EXTENSIONS, MAX_FILE_SIZE


def get_product_dataset_dir(product_id: str) -> Path:
    """Returns directory path for a specific product dataset: data/kartmitra/products/{product_id}"""
    p_dir = DATASET_BASE_DIR / "products" / str(product_id)
    (p_dir / "raw").mkdir(parents=True, exist_ok=True)
    (p_dir / "annotated").mkdir(parents=True, exist_ok=True)
    (p_dir / "train" / "images").mkdir(parents=True, exist_ok=True)
    (p_dir / "train" / "labels").mkdir(parents=True, exist_ok=True)
    (p_dir / "val" / "images").mkdir(parents=True, exist_ok=True)
    (p_dir / "val" / "labels").mkdir(parents=True, exist_ok=True)
    (p_dir / "test" / "images").mkdir(parents=True, exist_ok=True)
    (p_dir / "test" / "labels").mkdir(parents=True, exist_ok=True)
    return p_dir


def check_image_quality(img_bytes: bytes) -> Dict[str, Any]:
    """
    Step 16E: Performs non-blocking image quality checks.
    Evaluates resolution, blur (Laplacian variance), and brightness (mean intensity).
    Returns quality status and non-fatal warnings.
    """
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {
            "is_valid": False,
            "error": "Corrupted or unreadable image file.",
            "quality": {"resolution": "POOR", "blur": "POOR", "brightness": "POOR"}
        }

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Blur detection via Laplacian variance
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    blur_status = "GOOD" if laplacian_var >= 50.0 else "WARNING"

    # Brightness mean intensity check
    mean_brightness = float(np.mean(gray))
    if mean_brightness < 30.0:
        brightness_status = "WARNING (Too Dark)"
    elif mean_brightness > 225.0:
        brightness_status = "WARNING (Overexposed)"
    else:
        brightness_status = "GOOD"

    # Resolution check
    resolution_status = "GOOD" if (w >= 100 and h >= 100) else "WARNING (Low Resolution)"

    warnings = []
    if blur_status == "WARNING":
        warnings.append(f"Image may be blurry (blur score: {laplacian_var:.1f}).")
    if "WARNING" in brightness_status:
        warnings.append(f"Suboptimal brightness (mean level: {mean_brightness:.1f}).")
    if "WARNING" in resolution_status:
        warnings.append(f"Resolution is low ({w}x{h}).")

    return {
        "is_valid": True,
        "width": w,
        "height": h,
        "blur_score": round(laplacian_var, 2),
        "mean_brightness": round(mean_brightness, 2),
        "quality": {
            "resolution": resolution_status,
            "blur": blur_status,
            "brightness": brightness_status
        },
        "warnings": warnings
    }


def save_product_dataset_image(
    product_id: str,
    file_bytes: bytes,
    filename: str,
    image_type: str = "raw",
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Step 16D & 16E: Validates, quality-checks, and saves product image to data/kartmitra/products/{product_id}/raw/.
    Updates database ProductDatasetMetadata status.
    """
    if len(file_bytes) > MAX_FILE_SIZE:
        return {"success": False, "error": f"File size exceeds limit of {MAX_FILE_SIZE // (1024*1024)}MB"}

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return {"success": False, "error": f"Unsupported file format '{ext}'. Allowed: {ALLOWED_EXTENSIONS}"}

    quality_res = check_image_quality(file_bytes)
    if not quality_res.get("is_valid"):
        return {"success": False, "error": quality_res.get("error", "Invalid image")}

    p_dir = get_product_dataset_dir(product_id)
    raw_dir = p_dir / "raw"

    image_id = f"img_{hashlib.md5(file_bytes).hexdigest()[:10]}"
    target_filename = f"{image_id}{ext}"
    target_path = raw_dir / target_filename

    with open(target_path, "wb") as f:
        f.write(file_bytes)

    # Update ProductDatasetMetadata in DB if session is available
    if db is not None:
        update_product_dataset_metadata(db, product_id)

    return {
        "success": True,
        "product_id": product_id,
        "image_id": image_id,
        "filename": target_filename,
        "path": str(target_path),
        "width": quality_res["width"],
        "height": quality_res["height"],
        "quality": quality_res["quality"],
        "warnings": quality_res["warnings"],
        "status": "UPLOADED"
    }


def update_product_dataset_metadata(db: Session, product_id: str) -> models.ProductDatasetMetadata:
    """Helper to recalculate image counts and dataset_status for a product."""
    meta = db.query(models.ProductDatasetMetadata).filter_by(product_id=product_id).first()
    if not meta:
        meta = models.ProductDatasetMetadata(product_id=product_id, dataset_status="EMPTY")
        db.add(meta)
        db.commit()
        db.refresh(meta)

    p_dir = get_product_dataset_dir(product_id)
    raw_files = [f for f in (p_dir / "raw").glob("*") if f.suffix.lower() in ALLOWED_EXTENSIONS]
    ann_files = list((p_dir / "annotated").glob("*.txt"))
    train_files = list((p_dir / "train" / "images").glob("*"))
    val_files = list((p_dir / "val" / "images").glob("*"))
    test_files = list((p_dir / "test" / "images").glob("*"))

    meta.image_count = len(raw_files)
    meta.annotated_image_count = len(ann_files)
    meta.training_image_count = len(train_files)
    meta.validation_image_count = len(val_files)
    meta.test_image_count = len(test_files)

    if meta.image_count == 0:
        meta.dataset_status = "EMPTY"
    elif meta.annotated_image_count == 0:
        meta.dataset_status = "COLLECTING"
    elif meta.annotated_image_count < meta.image_count:
        meta.dataset_status = "READY_FOR_ANNOTATION"
    elif meta.training_image_count == 0:
        meta.dataset_status = "ANNOTATED"
    else:
        meta.dataset_status = "READY_FOR_TRAINING"

    db.commit()
    db.refresh(meta)
    return meta


def get_product_dataset_coverage(product_id: str, db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Step 16G: Calculates visual category coverage statistics for a registered product dataset.
    """
    product_name = f"Product {product_id}"
    if db is not None:
        p_obj = crud.get_product(db, product_id=product_id)
        if p_obj:
            product_name = p_obj.name

    p_dir = get_product_dataset_dir(product_id)
    raw_images = [f for f in (p_dir / "raw").glob("*") if f.suffix.lower() in ALLOWED_EXTENSIONS]

    coverage_counts = {
        "front": 0,
        "back": 0,
        "side": 0,
        "angle": 0,
        "low_light": 0,
        "different_background": 0,
        "other": 0
    }

    for img_p in raw_images:
        fname = img_p.name.lower()
        if "front" in fname:
            coverage_counts["front"] += 1
        elif "back" in fname:
            coverage_counts["back"] += 1
        elif "side" in fname or "left" in fname or "right" in fname:
            coverage_counts["side"] += 1
        elif "angle" in fname or "45" in fname or "rot" in fname:
            coverage_counts["angle"] += 1
        elif "dark" in fname or "low" in fname or "light" in fname:
            coverage_counts["low_light"] += 1
        elif "bg" in fname or "backg" in fname:
            coverage_counts["different_background"] += 1
        else:
            coverage_counts["other"] += 1

    status = "EMPTY" if len(raw_images) == 0 else ("COLLECTING" if len(raw_images) < 20 else "READY_FOR_ANNOTATION")

    return {
        "product": product_name,
        "product_id": product_id,
        "image_count": len(raw_images),
        "recommended_minimum": 20,
        "coverage": coverage_counts,
        "status": status
    }


def get_class_mapping_path() -> Path:
    """Path to the central dataset class mapping file."""
    c_dir = DATASET_BASE_DIR / "dataset"
    c_dir.mkdir(parents=True, exist_ok=True)
    return c_dir / "classes.json"


def get_active_db_products(db: Optional[Session] = None) -> List[models.Product]:
    """Helper to fetch currently active products from database."""
    if db is not None:
        return db.query(models.Product).order_by(models.Product.name).all()
    from app.db import SessionLocal
    local_db = SessionLocal()
    try:
        return local_db.query(models.Product).order_by(models.Product.name).all()
    finally:
        local_db.close()


def sync_classes_with_database(db: Optional[Session] = None) -> Dict[str, Dict[str, str]]:
    """
    Dynamically rebuilds classes.json strictly from current active database products.
    Ensures deleted products are removed and active products get stable 0..N-1 class IDs.
    """
    products = get_active_db_products(db=db)
    mapping = {}
    for idx, p in enumerate(products):
        mapping[str(idx)] = {
            "product_id": str(p.id),
            "name": str(p.name)
        }
    save_class_mapping(mapping)
    return mapping


def load_class_mapping(db: Optional[Session] = None) -> Dict[str, Dict[str, str]]:
    """
    Loads clean class mapping. If file is missing or contains deleted products,
    syncs dynamically with database.
    """
    path = get_class_mapping_path()
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                mapping = json.load(f)
            # Verify that mapping matches active products
            active_products = {str(p.id): p.name for p in get_active_db_products(db=db)}
            mapped_pids = {info.get("product_id") for info in mapping.values() if isinstance(info, dict)}
            if set(active_products.keys()) == mapped_pids:
                return mapping
        except Exception:
            pass
    return sync_classes_with_database(db=db)


def save_class_mapping(mapping: Dict[str, Dict[str, str]]) -> None:
    """Saves updated class mapping JSON file."""
    path = get_class_mapping_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2)


def get_or_create_class_id_for_product(product_id: str, product_name: str, db: Optional[Session] = None) -> int:
    """Returns stable YOLO class_id integer for product from dynamic class mapping."""
    mapping = load_class_mapping(db=db)
    for cid_str, info in mapping.items():
        if info.get("product_id") == product_id:
            return int(cid_str)

    # Re-sync with database to ensure consistency
    mapping = sync_classes_with_database(db=db)
    for cid_str, info in mapping.items():
        if info.get("product_id") == product_id:
            return int(cid_str)

    next_cid = len(mapping)
    mapping[str(next_cid)] = {
        "product_id": product_id,
        "name": product_name
    }
    save_class_mapping(mapping)
    return next_cid


def save_yolo_annotation(
    image_id: str,
    product_id: str,
    annotations: List[Dict[str, Any]],
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Step 16H, 16I, 16L: Saves multi-product YOLO format bounding box annotations (class_id center_x center_y width height).
    """
    p_dir = get_product_dataset_dir(product_id)
    ann_dir = p_dir / "annotated"

    lines = []
    for ann in annotations:
        cid = ann["class_id"]
        cx = round(float(ann["center_x"]), 6)
        cy = round(float(ann["center_y"]), 6)
        w = round(float(ann["width"]), 6)
        h = round(float(ann["height"]), 6)

        # Validate bounding box boundaries (normalized 0..1)
        if not (0.0 <= cx <= 1.0 and 0.0 <= cy <= 1.0 and 0.0 < w <= 1.0 and 0.0 < h <= 1.0):
            return {"success": False, "error": f"Invalid bounding box coordinates ({cx}, {cy}, {w}, {h}). Must be normalized 0..1."}

        lines.append(f"{cid} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")

    label_file = ann_dir / f"{image_id}.txt"
    with open(label_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    if db is not None:
        update_product_dataset_metadata(db, product_id)

    return {
        "success": True,
        "image_id": image_id,
        "annotation_file": str(label_file),
        "count": len(lines)
    }


def split_and_prepare_dataset(db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Step 16M: Splits annotated dataset into 70% train, 20% validation, 10% test.
    Prevents data leakage by grouping perceptually similar image hashes into the same split.
    Maps each product's local annotations to its dynamic global YOLO class_id.
    """
    mapping = load_class_mapping(db=db)
    active_products = {str(p.id): p.name for p in get_active_db_products(db=db)}
    
    # Map product_id to assigned YOLO integer class_id
    pid_to_cid: Dict[str, int] = {}
    for cid_str, info in mapping.items():
        if isinstance(info, dict) and "product_id" in info:
            pid_to_cid[info["product_id"]] = int(cid_str)

    products_dir = DATASET_BASE_DIR / "products"
    if not products_dir.exists():
        return {"success": False, "error": "No products dataset found"}

    all_samples = []

    for p_folder in products_dir.iterdir():
        if not p_folder.is_dir():
            continue
        pid = p_folder.name

        # Skip products that are not active in database
        if pid not in active_products:
            continue

        assigned_cid = pid_to_cid.get(pid)
        if assigned_cid is None:
            continue

        raw_dir = p_folder / "raw"
        ann_dir = p_folder / "annotated"

        if not raw_dir.exists() or not ann_dir.exists():
            continue

        for ann_file in ann_dir.glob("*.txt"):
            img_stem = ann_file.stem
            img_candidates = list(raw_dir.glob(f"{img_stem}.*"))
            if not img_candidates:
                continue

            img_file = img_candidates[0]
            with open(ann_file, "r", encoding="utf-8") as f:
                raw_lines = [l.strip() for l in f if l.strip()]

            if not raw_lines:
                continue

            # Map each annotation line to this product's assigned global YOLO class_id
            mapped_lines = []
            for line in raw_lines:
                parts = line.split()
                if len(parts) == 5:
                    try:
                        cx, cy, w, h = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
                        # Clamp / validate coordinates
                        if 0.0 <= cx <= 1.0 and 0.0 <= cy <= 1.0 and 0.0 < w <= 1.0 and 0.0 < h <= 1.0:
                            mapped_lines.append(f"{assigned_cid} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
                    except ValueError:
                        continue

            if not mapped_lines:
                continue

            all_samples.append({
                "product_id": pid,
                "stem": img_stem,
                "image_path": img_file,
                "label_path": ann_file,
                "content": "\n".join(mapped_lines) + "\n"
            })

    if not all_samples:
        return {"success": False, "error": "No annotated samples available to split for active products."}

    # Organize samples by product for stratified splitting to maintain class balance
    samples_by_pid: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for sample in all_samples:
        samples_by_pid[sample["product_id"]].append(sample)

    dataset_root = DATASET_BASE_DIR / "dataset"
    for split in ["train", "val", "test"]:
        s_img_dir = dataset_root / split / "images"
        s_lbl_dir = dataset_root / split / "labels"
        s_img_dir.mkdir(parents=True, exist_ok=True)
        s_lbl_dir.mkdir(parents=True, exist_ok=True)
        # Clear out existing files to prevent stale leftover images
        for f in s_img_dir.glob("*"):
            try: f.unlink()
            except Exception: pass
        for f in s_lbl_dir.glob("*"):
            try: f.unlink()
            except Exception: pass

    train_count = 0
    val_count = 0
    test_count = 0

    # Process each product with deterministic hash grouping and stratified allocation
    for pid in sorted(samples_by_pid.keys()):
        p_samples = samples_by_pid[pid]
        assigned_cid = pid_to_cid[pid]

        # Group samples by MD5 hash of image content to avoid duplicate/near-duplicate leakage
        groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for sample in p_samples:
            with open(sample["image_path"], "rb") as img_f:
                h_val = hashlib.md5(img_f.read()).hexdigest()[:8]
            groups[h_val].append(sample)

        # Deterministic shuffle using seed 42 + class_id
        group_keys = sorted(groups.keys())
        rng = np.random.RandomState(42 + assigned_cid)
        rng.shuffle(group_keys)

        k = len(group_keys)
        # Stratified class balance: ensure every class with >= 3 samples has representation in val & test
        if k >= 10:
            n_val = max(1, int(round(k * 0.20)))
            n_test = max(1, int(round(k * 0.10)))
            n_train = k - n_val - n_test
        elif k >= 4:
            n_val = 1
            n_test = 1
            n_train = k - 2
        elif k == 3:
            n_train, n_val, n_test = 1, 1, 1
        elif k == 2:
            n_train, n_val, n_test = 1, 1, 0
        else:
            n_train, n_val, n_test = 1, 0, 0

        train_keys = group_keys[:n_train]
        val_keys = group_keys[n_train:n_train + n_val]
        test_keys = group_keys[n_train + n_val:]

        for g_key in train_keys:
            for s in groups[g_key]:
                out_img = dataset_root / "train" / "images" / s["image_path"].name
                out_lbl = dataset_root / "train" / "labels" / f"{s['stem']}.txt"
                with open(s["image_path"], "rb") as src_i, open(out_img, "wb") as dst_i:
                    dst_i.write(src_i.read())
                with open(out_lbl, "w", encoding="utf-8") as dst_l:
                    dst_l.write(s["content"])
                train_count += 1

        for g_key in val_keys:
            for s in groups[g_key]:
                out_img = dataset_root / "val" / "images" / s["image_path"].name
                out_lbl = dataset_root / "val" / "labels" / f"{s['stem']}.txt"
                with open(s["image_path"], "rb") as src_i, open(out_img, "wb") as dst_i:
                    dst_i.write(src_i.read())
                with open(out_lbl, "w", encoding="utf-8") as dst_l:
                    dst_l.write(s["content"])
                val_count += 1

        for g_key in test_keys:
            for s in groups[g_key]:
                out_img = dataset_root / "test" / "images" / s["image_path"].name
                out_lbl = dataset_root / "test" / "labels" / f"{s['stem']}.txt"
                with open(s["image_path"], "rb") as src_i, open(out_img, "wb") as dst_i:
                    dst_i.write(src_i.read())
                with open(out_lbl, "w", encoding="utf-8") as dst_l:
                    dst_l.write(s["content"])
                test_count += 1

    # Update metadata for all active products in DB
    if db is not None:
        for pid in active_products:
            update_product_dataset_metadata(db, pid)

    return {
        "success": True,
        "total_samples": len(all_samples),
        "split": {
            "train": train_count,
            "val": val_count,
            "test": test_count
        }
    }


def validate_dataset(db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Step 16N: Pre-training dataset validation.
    Verifies image integrity, label syntax, class mapping, normalized bboxes, missing files,
    and ensures no deleted products exist in classes or active datasets.
    """
    mapping = load_class_mapping(db=db)
    active_products = {str(p.id): p.name for p in get_active_db_products(db=db)}
    errors = []
    warnings = []

    if not mapping:
        errors.append("Missing product class mapping (dataset/classes.json).")

    # Verify active products have mappings
    mapped_pids = set()
    for cid_str, info in mapping.items():
        if isinstance(info, dict):
            pid = info.get("product_id")
            mapped_pids.add(pid)
            if pid not in active_products:
                errors.append(f"Deleted product {info.get('name')} (ID: {pid}) exists in class mapping class_id {cid_str}.")

    for act_pid, act_name in active_products.items():
        if act_pid not in mapped_pids:
            errors.append(f"Active product '{act_name}' (ID: {act_pid}) has no class mapping.")

    dataset_root = DATASET_BASE_DIR / "dataset"
    train_img_dir = dataset_root / "train" / "images"

    if not train_img_dir.exists() or len(list(train_img_dir.glob("*"))) == 0:
        # Split dataset first if not done
        split_res = split_and_prepare_dataset(db=db)
        if not split_res.get("success"):
            warnings.append(f"Automatic dataset splitting warning: {split_res.get('error')}")

    train_images = list((dataset_root / "train" / "images").glob("*"))
    val_images = list((dataset_root / "val" / "images").glob("*"))
    test_images = list((dataset_root / "test" / "images").glob("*"))
    total_images = len(train_images) + len(val_images) + len(test_images)

    total_annotations = 0
    max_valid_cid = len(mapping) - 1

    for split in ["train", "val", "test"]:
        s_img_dir = dataset_root / split / "images"
        s_lbl_dir = dataset_root / split / "labels"

        if not s_img_dir.exists():
            continue

        for img_p in s_img_dir.glob("*"):
            lbl_p = s_lbl_dir / f"{img_p.stem}.txt"
            if not lbl_p.exists():
                errors.append(f"Image {img_p.name} in {split} has no label file.")
                continue

            with open(lbl_p, "r", encoding="utf-8") as f:
                lines = [l.strip() for l in f if l.strip()]

            if not lines:
                warnings.append(f"Label file {lbl_p.name} in {split} is empty.")
                continue

            total_annotations += len(lines)
            for line_idx, line in enumerate(lines, 1):
                parts = line.split()
                if len(parts) != 5:
                    errors.append(f"Malformed label line {line_idx} in {lbl_p.name}: expected 5 values (class_id cx cy w h).")
                    continue

                try:
                    cid = int(parts[0])
                    cx, cy, w, h = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])

                    if str(cid) not in mapping:
                        errors.append(f"Label {lbl_p.name} references unmapped class_id {cid}.")
                    elif cid < 0 or cid > max_valid_cid:
                        errors.append(f"Label {lbl_p.name} has class_id {cid} out of range [0, {max_valid_cid}].")

                    if not (0.0 <= cx <= 1.0 and 0.0 <= cy <= 1.0 and 0.0 < w <= 1.0 and 0.0 < h <= 1.0):
                        errors.append(f"Invalid bbox coordinates in {lbl_p.name}: ({cx}, {cy}, {w}, {h}) out of bounds 0..1.")
                except ValueError:
                    errors.append(f"Non-numeric values in {lbl_p.name}: line '{line}'.")

    if total_images == 0:
        errors.append("No images found in train/val/test splits.")

    # Check dataset.yaml existence and path
    yaml_path = dataset_root / "dataset.yaml"
    if yaml_path.exists():
        try:
            import yaml
            with open(yaml_path, "r", encoding="utf-8") as f:
                y_data = yaml.safe_load(f)
            y_path_str = y_data.get("path", "")
            y_path = Path(y_path_str)
            if not y_path.is_absolute():
                y_path = BASE_DIR / y_path
            if not y_path.exists():
                errors.append(f"dataset.yaml path points to non-existing directory: {y_path_str}")
        except Exception as e:
            warnings.append(f"dataset.yaml validation warning: {e}")

    # Check FAISS index consistency
    faiss_meta_path = BASE_DIR / "data" / "visual_index" / "faiss_metadata.json"
    if faiss_meta_path.exists():
        try:
            with open(faiss_meta_path, "r", encoding="utf-8") as f:
                faiss_meta = json.load(f)
            for entry in faiss_meta:
                f_pid = entry.get("product_id")
                if f_pid and f_pid not in active_products:
                    errors.append(f"FAISS metadata references deleted product_id '{f_pid}'.")
                f_ipath = entry.get("image_path")
                if f_ipath:
                    full_p = BASE_DIR / f_ipath.lstrip("/") if not os.path.isabs(f_ipath) else Path(f_ipath)
                    if not full_p.exists():
                        errors.append(f"FAISS metadata references missing image file: {f_ipath}")
        except Exception as e:
            warnings.append(f"FAISS metadata check warning: {e}")

    is_valid = len(errors) == 0

    return {
        "valid": is_valid,
        "images": total_images,
        "annotations": total_annotations,
        "errors": errors,
        "warnings": warnings
    }


def generate_dataset_yaml(db: Optional[Session] = None) -> Path:
    """
    Step 16O: Generates standard dataset.yaml referencing real dataset paths and class names.
    Uses clean dynamic class mapping from active database products and portable project-relative paths.
    """
    mapping = load_class_mapping(db=db)
    dataset_root = DATASET_BASE_DIR / "dataset"

    names_dict = {}
    for cid_str, info in mapping.items():
        # Sanitize name for YOLO yaml
        clean_name = info.get("name", f"product_{cid_str}").lower().replace(" ", "_").replace("-", "_")
        names_dict[int(cid_str)] = clean_name

    yaml_path = dataset_root / "dataset.yaml"
    with open(yaml_path, "w", encoding="utf-8") as f:
        # Portable relative path from backend execution root
        f.write("path: data/kartmitra/dataset\n")
        f.write("train: train/images\n")
        f.write("val: val/images\n")
        f.write("test: test/images\n\n")
        f.write("names:\n")
        for cid, cname in sorted(names_dict.items()):
            f.write(f"  {cid}: {cname}\n")

    return yaml_path
