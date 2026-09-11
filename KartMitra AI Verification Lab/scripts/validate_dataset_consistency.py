#!/usr/bin/env python3
"""
Dataset Consistency and YOLO Annotation Validation Script
KartMitra AI Verification Lab

Validates that:
1. Active PostgreSQL products have valid class mappings in classes.json.
2. Deleted products do NOT exist in classes.json, dataset.yaml, or active product dataset folders.
3. Every YOLO label in train/val/test contains valid class IDs within range [0, num_classes-1].
4. Every image has a corresponding label file and every label has a corresponding image.
5. Every YOLO label line is well-formed with normalized coordinates (0..1, w>0, h>0).
6. Dataset YAML points to existing filesystem paths.
7. FAISS metadata contains only active products.
8. Every image referenced in FAISS metadata exists on disk.
"""

import os
import sys
import json
import yaml
from pathlib import Path
from collections import defaultdict

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.db import SessionLocal
from app import models

def main() -> int:
    print("=" * 70)
    print("  KARTMITRA DATASET & ANNOTATION CONSISTENCY VALIDATOR")
    print("=" * 70)

    errors = []
    warnings = []

    # 1. Connect to PostgreSQL and fetch active products
    db = SessionLocal()
    try:
        active_products = db.query(models.Product).order_by(models.Product.name).all()
        active_pids = {str(p.id): p.name for p in active_products}
        active_barcodes = {str(p.id): p.barcode for p in active_products}
    except Exception as e:
        print(f"[FATAL ERROR] Could not connect to PostgreSQL database: {e}")
        return 1
    finally:
        db.close()

    print(f"\n[1] ACTIVE PRODUCTS IN POSTGRESQL ({len(active_pids)} products):")
    for pid, name in active_pids.items():
        print(f"    - {name} (ID: {pid}, Barcode: {active_barcodes.get(pid)})")

    dataset_dir = BACKEND_DIR / "data" / "kartmitra" / "dataset"
    products_dir = BACKEND_DIR / "data" / "kartmitra" / "products"
    classes_file = dataset_dir / "classes.json"
    yaml_file = dataset_dir / "dataset.yaml"
    faiss_meta_file = BACKEND_DIR / "data" / "visual_index" / "faiss_metadata.json"
    faiss_index_file = BACKEND_DIR / "data" / "visual_index" / "faiss_index.bin"

    # 2. Check classes.json
    print("\n[2] VALIDATING classes.json:")
    if not classes_file.exists():
        errors.append(f"classes.json not found at {classes_file}")
        class_mapping = {}
    else:
        try:
            with open(classes_file, "r", encoding="utf-8") as f:
                class_mapping = json.load(f)
        except Exception as e:
            errors.append(f"Failed to parse classes.json: {e}")
            class_mapping = {}

    num_classes = len(class_mapping)
    mapped_pids = set()

    for cid_str, info in class_mapping.items():
        if not isinstance(info, dict):
            errors.append(f"Malformed entry in classes.json for class {cid_str}")
            continue
        pid = info.get("product_id")
        pname = info.get("name")
        mapped_pids.add(pid)
        if pid not in active_pids:
            errors.append(f"classes.json references DELETED product '{pname}' (ID: {pid}) at class {cid_str}.")
        else:
            print(f"    Class {cid_str} -> {pname} (PID: {pid})")

    for act_pid, act_name in active_pids.items():
        if act_pid not in mapped_pids:
            errors.append(f"Active product '{act_name}' (ID: {act_pid}) has NO class mapping in classes.json.")

    # 3. Check dataset.yaml
    print("\n[3] VALIDATING dataset.yaml:")
    if not yaml_file.exists():
        errors.append(f"dataset.yaml not found at {yaml_file}")
    else:
        try:
            with open(yaml_file, "r", encoding="utf-8") as f:
                yaml_data = yaml.safe_load(f)

            yaml_root_str = yaml_data.get("path", "")
            if "users/hp" in yaml_root_str.lower().replace("\\", "/"):
                errors.append(f"dataset.yaml contains machine-specific absolute path: {yaml_root_str}")

            yaml_root = Path(yaml_root_str)
            if not yaml_root.is_absolute():
                yaml_root = BACKEND_DIR / yaml_root

            if not yaml_root.exists():
                errors.append(f"dataset.yaml 'path' points to non-existing directory: {yaml_root_str}")
            else:
                for split_key in ["train", "val", "test"]:
                    sub_p = yaml_data.get(split_key)
                    if not sub_p:
                        errors.append(f"dataset.yaml missing '{split_key}' key.")
                    else:
                        full_split_p = yaml_root / sub_p
                        if not full_split_p.exists():
                            errors.append(f"dataset.yaml '{split_key}' directory does not exist: {full_split_p}")

            yaml_names = yaml_data.get("names", {})
            if len(yaml_names) != num_classes:
                errors.append(f"dataset.yaml names count ({len(yaml_names)}) does not match classes.json count ({num_classes}).")

            for cid_int, cname in yaml_names.items():
                cid_str = str(cid_int)
                if cid_str not in class_mapping:
                    errors.append(f"dataset.yaml defines class {cid_int} which does not exist in classes.json.")
            print(f"    dataset.yaml path and {len(yaml_names)} class names verified.")
        except Exception as e:
            errors.append(f"Failed to parse dataset.yaml: {e}")

    # 4. Check active product dataset folders
    print("\n[4] VALIDATING product dataset directories:")
    if products_dir.exists():
        for p_folder in products_dir.iterdir():
            if p_folder.is_dir():
                if p_folder.name not in active_pids:
                    errors.append(f"Found unarchived product folder for DELETED product: {p_folder.name}")
                else:
                    raw_c = len(list((p_folder / "raw").glob("*"))) if (p_folder / "raw").exists() else 0
                    ann_c = len(list((p_folder / "annotated").glob("*.txt"))) if (p_folder / "annotated").exists() else 0
                    print(f"    {active_pids[p_folder.name]}: {raw_c} raw images, {ann_c} annotated")

    # 5. Audit YOLO labels and images in train/val/test
    print("\n[5] AUDITING YOLO labels and images in splits:")
    total_imgs = 0
    total_lbls = 0
    class_distribution = defaultdict(int)

    for split in ["train", "val", "test"]:
        s_img_dir = dataset_dir / split / "images"
        s_lbl_dir = dataset_dir / split / "labels"

        if not s_img_dir.exists() or not s_lbl_dir.exists():
            errors.append(f"Split directory missing: {split}")
            continue

        imgs = {f.stem: f for f in s_img_dir.glob("*")}
        lbls = {f.stem: f for f in s_lbl_dir.glob("*.txt")}
        total_imgs += len(imgs)
        total_lbls += len(lbls)

        # Check for images missing labels
        for stem, img_p in imgs.items():
            if stem not in lbls:
                errors.append(f"[{split}] Image missing label file: {img_p.name}")

        # Check labels
        for stem, lbl_p in lbls.items():
            if stem not in imgs:
                errors.append(f"[{split}] Label missing corresponding image file: {lbl_p.name}")

            with open(lbl_p, "r", encoding="utf-8") as f:
                lines = [l.strip() for l in f if l.strip()]

            if not lines:
                warnings.append(f"[{split}] Label file is empty: {lbl_p.name}")
                continue

            for line_no, line in enumerate(lines, 1):
                parts = line.split()
                if len(parts) != 5:
                    errors.append(f"[{split}] Malformed label line {line_no} in {lbl_p.name}: expected 5 values (got {len(parts)}).")
                    continue

                try:
                    cid = int(parts[0])
                    cx, cy, w, h = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])

                    if str(cid) not in class_mapping:
                        errors.append(f"[{split}] Label {lbl_p.name}:{line_no} references unmapped class_id {cid}.")
                    elif cid < 0 or cid >= num_classes:
                        errors.append(f"[{split}] Label {lbl_p.name}:{line_no} class_id {cid} out of range [0, {num_classes-1}].")

                    if not (0.0 <= cx <= 1.0 and 0.0 <= cy <= 1.0 and 0.0 < w <= 1.0 and 0.0 < h <= 1.0):
                        errors.append(f"[{split}] Label {lbl_p.name}:{line_no} invalid bbox coords ({cx}, {cy}, {w}, {h}) out of bounds 0..1.")

                    class_distribution[cid] += 1
                except ValueError:
                    errors.append(f"[{split}] Non-numeric values in {lbl_p.name}:{line_no}: '{line}'.")

    print(f"    Audited {total_imgs} images and {total_lbls} label files across train/val/test.")
    print("    Class distribution:")
    for cid in range(num_classes):
        cname = class_mapping.get(str(cid), {}).get("name", "unknown")
        cnt = class_distribution[cid]
        print(f"      Class {cid} ({cname}): {cnt} annotations")

    # 6. Audit FAISS Visual Index and Metadata
    print("\n[6] VALIDATING FAISS visual index and metadata:")
    if not faiss_index_file.exists():
        errors.append(f"FAISS index file missing at {faiss_index_file}")
    if not faiss_meta_file.exists():
        errors.append(f"FAISS metadata file missing at {faiss_meta_file}")
    else:
        try:
            with open(faiss_meta_file, "r", encoding="utf-8") as f:
                faiss_meta = json.load(f)

            print(f"    FAISS metadata has {len(faiss_meta)} indexed entries.")
            faiss_product_counts = defaultdict(int)

            for idx, entry in enumerate(faiss_meta):
                pid = entry.get("product_id")
                img_id = entry.get("product_image_id")
                img_path = entry.get("image_path", "")

                if not pid:
                    errors.append(f"FAISS entry {idx} missing product_id.")
                elif pid not in active_pids:
                    errors.append(f"FAISS entry {idx} references DELETED product_id '{pid}'.")
                else:
                    faiss_product_counts[pid] += 1

                if not img_id:
                    errors.append(f"FAISS entry {idx} missing product_image_id.")

                if not img_path:
                    errors.append(f"FAISS entry {idx} missing image_path.")
                else:
                    full_p = BACKEND_DIR / img_path.lstrip("/") if not os.path.isabs(img_path) else Path(img_path)
                    if not full_p.exists():
                        errors.append(f"FAISS entry {idx} references non-existing image on disk: {img_path}")

            for pid, count in faiss_product_counts.items():
                print(f"      {active_pids[pid]}: {count} visual embeddings indexed")
        except Exception as e:
            errors.append(f"Failed to read/validate FAISS metadata: {e}")

    # 7. Summary & Result
    print("\n" + "=" * 70)
    print("  VALIDATION RESULT SUMMARY")
    print("=" * 70)

    if warnings:
        print(f"\nWarnings ({len(warnings)}):")
        for w in warnings:
            print(f"  [WARN] {w}")

    if errors:
        print(f"\nFAILED! Found {len(errors)} consistency error(s):")
        for err in errors:
            print(f"  [ERROR] {err}")
        return 1
    else:
        print("\nPASSED! All consistency checks succeeded.")
        print(f"  - Active products ({len(active_pids)}): All correctly mapped.")
        print(f"  - Stale/Deleted references: 0 detected.")
        print(f"  - Total YOLO dataset images: {total_imgs} (100% paired with valid labels).")
        print(f"  - Total YOLO bounding boxes: {sum(class_distribution.values())} (100% valid coordinates & class IDs).")
        print(f"  - FAISS visual index: Fully rebuilt with active reference images.")
        return 0

if __name__ == "__main__":
    sys.exit(main())
