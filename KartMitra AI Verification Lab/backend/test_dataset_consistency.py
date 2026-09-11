import os
import json
import yaml
from pathlib import Path
import pytest
from app.db import SessionLocal
from app import models, dataset_service, visual_index_service, visual_embedding_service
from app.config import BASE_DIR, DATASET_BASE_DIR, VISUAL_INDEX_DIR

def test_database_is_single_source_of_truth():
    """TASK 1: Verify active products in PostgreSQL."""
    db = SessionLocal()
    try:
        products = db.query(models.Product).all()
        assert len(products) > 0, "No active products found in PostgreSQL database."
        pids = [p.id for p in products]
        # Ensure deleted products are not in database
        deleted_names = ["coca cola", "cadbury", "tata salt", "vivo v50", "samsung", "microbiology", "notebook"]
        for p in products:
            for d_name in deleted_names:
                assert d_name not in p.name.lower(), f"Deleted product '{p.name}' still exists in database!"
    finally:
        db.close()

def test_classes_json_matches_active_products():
    """TASK 2 & 3: Verify classes.json strictly matches PostgreSQL active products."""
    db = SessionLocal()
    try:
        products = db.query(models.Product).order_by(models.Product.name).all()
        active_pids = {str(p.id): p.name for p in products}
    finally:
        db.close()

    classes_path = DATASET_BASE_DIR / "dataset" / "classes.json"
    assert classes_path.exists(), "classes.json missing."

    with open(classes_path, "r", encoding="utf-8") as f:
        mapping = json.load(f)

    assert len(mapping) == len(active_pids), f"classes.json count ({len(mapping)}) does not match active products count ({len(active_pids)})."

    mapped_pids = set()
    for cid_str, info in mapping.items():
        cid = int(cid_str)
        assert 0 <= cid < len(active_pids), f"class_id {cid} out of range [0, {len(active_pids)-1}]."
        pid = info.get("product_id")
        assert pid in active_pids, f"classes.json references unmapped/deleted product {pid}."
        mapped_pids.add(pid)

    assert mapped_pids == set(active_pids.keys()), "Not all active products are mapped in classes.json."

def test_dataset_yaml_structure_and_portability():
    """TASK 3 & 6: Verify dataset.yaml points to valid paths, active classes, and uses portable relative paths."""
    yaml_path = DATASET_BASE_DIR / "dataset" / "dataset.yaml"
    assert yaml_path.exists(), "dataset.yaml missing."

    with open(yaml_path, "r", encoding="utf-8") as f:
        yaml_data = yaml.safe_load(f)

    path_str = yaml_data.get("path", "")
    assert "users/hp" not in path_str.lower().replace("\\", "/"), f"dataset.yaml contains machine-specific path: {path_str}"

    root_path = Path(path_str)
    if not root_path.is_absolute():
        root_path = BASE_DIR / root_path
    assert root_path.exists(), f"dataset.yaml path does not exist: {root_path}"

    for split in ["train", "val", "test"]:
        sub = yaml_data.get(split)
        assert sub is not None, f"Missing {split} in dataset.yaml"
        full_p = root_path / sub
        assert full_p.exists(), f"Directory for {split} does not exist: {full_p}"

    classes_path = DATASET_BASE_DIR / "dataset" / "classes.json"
    with open(classes_path, "r", encoding="utf-8") as f:
        mapping = json.load(f)

    names = yaml_data.get("names", {})
    assert len(names) == len(mapping), f"Expected {len(mapping)} classes in dataset.yaml, got {len(names)}"

def test_yolo_labels_and_coordinates_validity():
    """TASK 4 & 5: Ensure every YOLO label is valid, normalized, within class range, and paired."""
    classes_path = DATASET_BASE_DIR / "dataset" / "classes.json"
    with open(classes_path, "r", encoding="utf-8") as f:
        mapping = json.load(f)

    valid_cids = {int(cid) for cid in mapping.keys()}
    dataset_root = DATASET_BASE_DIR / "dataset"

    for split in ["train", "val", "test"]:
        img_dir = dataset_root / split / "images"
        lbl_dir = dataset_root / split / "labels"

        assert img_dir.exists(), f"{split}/images missing"
        assert lbl_dir.exists(), f"{split}/labels missing"

        images = list(img_dir.glob("*"))
        labels = list(lbl_dir.glob("*.txt"))

        img_stems = {f.stem for f in images}
        lbl_stems = {f.stem for f in labels}

        assert img_stems == lbl_stems, f"Mismatch between images and labels in {split} split."

        for lbl_p in labels:
            with open(lbl_p, "r", encoding="utf-8") as f:
                lines = [l.strip() for l in f if l.strip()]

            assert len(lines) > 0, f"Label file {lbl_p} is empty."

            for line in lines:
                parts = line.split()
                assert len(parts) == 5, f"Malformed label in {lbl_p}: '{line}'"
                cid = int(parts[0])
                cx, cy, w, h = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])

                assert cid in valid_cids, f"Invalid class ID {cid} in {lbl_p}."
                assert 0.0 <= cx <= 1.0, f"Invalid cx {cx} in {lbl_p}"
                assert 0.0 <= cy <= 1.0, f"Invalid cy {cy} in {lbl_p}"
                assert 0.0 < w <= 1.0, f"Invalid w {w} in {lbl_p}"
                assert 0.0 < h <= 1.0, f"Invalid h {h} in {lbl_p}"

def test_no_deleted_products_in_product_folders():
    """TASK 5: Ensure deleted product folders are archived and not in active directory."""
    db = SessionLocal()
    try:
        active_pids = {str(p.id) for p in db.query(models.Product).all()}
    finally:
        db.close()

    prod_dir = DATASET_BASE_DIR / "products"
    for folder in prod_dir.iterdir():
        if folder.is_dir():
            assert folder.name in active_pids, f"Deleted product folder {folder.name} found in active products directory!"

def test_faiss_visual_index_consistency():
    """TASK 8 & 9: Verify FAISS visual index contains only active products with valid images."""
    db = SessionLocal()
    try:
        active_pids = {str(p.id) for p in db.query(models.Product).all()}
    finally:
        db.close()

    meta_path = VISUAL_INDEX_DIR / "faiss_metadata.json"
    index_path = VISUAL_INDEX_DIR / "faiss_index.bin"

    assert meta_path.exists(), "faiss_metadata.json does not exist."
    assert index_path.exists(), "faiss_index.bin does not exist."

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    assert len(meta) > 0, "FAISS metadata is empty."

    for entry in meta:
        pid = entry.get("product_id")
        assert pid in active_pids, f"FAISS metadata references deleted product {pid}!"
        img_path = entry.get("image_path")
        assert img_path is not None, "Missing image_path in FAISS metadata."
        full_p = BASE_DIR / img_path.lstrip("/") if not os.path.isabs(img_path) else Path(img_path)
        assert full_p.exists(), f"Image referenced in FAISS metadata does not exist: {full_p}"

def test_dataset_service_validate_dataset():
    """TASK 10: Run the unified validate_dataset service method."""
    db = SessionLocal()
    try:
        res = dataset_service.validate_dataset(db=db)
        assert res["valid"] is True, f"Dataset validation failed: {res['errors']}"
        assert len(res["errors"]) == 0
        assert res["images"] == 100, f"Expected 100 images in YOLO split, found {res['images']}"
    finally:
        db.close()

def test_deleted_products_excluded_from_splits():
    """Verify that deleted products (MicroBiology, Notebook, Milk, etc.) do NOT appear in any split."""
    classes_path = DATASET_BASE_DIR / "dataset" / "classes.json"
    with open(classes_path, "r", encoding="utf-8") as f:
        mapping = json.load(f)

    # Only active products should be in mapping
    db = SessionLocal()
    try:
        active_names = {p.name.lower() for p in db.query(models.Product).all()}
    finally:
        db.close()

    for cid, info in mapping.items():
        assert info["name"].lower() in active_names, f"Deleted product {info['name']} found in classes.json!"

    # Ensure no label file has class IDs beyond active classes
    dataset_root = DATASET_BASE_DIR / "dataset"
    valid_cids = {int(cid) for cid in mapping.keys()}
    for split in ["train", "val", "test"]:
        for lbl in (dataset_root / split / "labels").glob("*.txt"):
            with open(lbl, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        cid = int(line.split()[0])
                        assert cid in valid_cids, f"Invalid or stale class ID {cid} found in {lbl}!"

def test_all_active_classes_represented_in_all_splits():
    """Verify class balance: all active classes have representation in train, val, and test."""
    classes_path = DATASET_BASE_DIR / "dataset" / "classes.json"
    with open(classes_path, "r", encoding="utf-8") as f:
        mapping = json.load(f)

    active_cids = [int(cid) for cid in mapping.keys()]
    dataset_root = DATASET_BASE_DIR / "dataset"

    for split in ["train", "val", "test"]:
        split_cids = set()
        for lbl in (dataset_root / split / "labels").glob("*.txt"):
            with open(lbl, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        split_cids.add(int(line.split()[0]))
        for cid in active_cids:
            assert cid in split_cids, f"Class {cid} has 0 samples in {split} split!"

def test_no_cross_split_data_leakage():
    """Verify that no image filenames and no image content hashes cross train/val/test splits."""
    import hashlib
    dataset_root = DATASET_BASE_DIR / "dataset"
    split_stems = {}
    split_hashes = {}

    for split in ["train", "val", "test"]:
        img_files = list((dataset_root / split / "images").glob("*"))
        split_stems[split] = {f.stem for f in img_files}
        hashes = set()
        for f in img_files:
            with open(f, "rb") as fh:
                hashes.add(hashlib.md5(fh.read()).hexdigest())
        split_hashes[split] = hashes

    assert len(split_stems["train"] & split_stems["val"]) == 0, "Filename overlap between train and val!"
    assert len(split_stems["train"] & split_stems["test"]) == 0, "Filename overlap between train and test!"
    assert len(split_stems["val"] & split_stems["test"]) == 0, "Filename overlap between val and test!"

    assert len(split_hashes["train"] & split_hashes["val"]) == 0, "Perceptual content hash leakage between train and val!"
    assert len(split_hashes["train"] & split_hashes["test"]) == 0, "Perceptual content hash leakage between train and test!"
    assert len(split_hashes["val"] & split_hashes["test"]) == 0, "Perceptual content hash leakage between val and test!"

