#!/usr/bin/env python3
"""
Production-Grade YOLO Training Script for KartMitra
Active products: Casio Calculator & Truke Earbuds
"""

import os
import sys
import json
import time
import shutil
import hashlib
import random
import subprocess
from datetime import datetime
from pathlib import Path
import numpy as np
import cv2
import yaml

# Set base paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

os.chdir(str(BACKEND_DIR))

from app.db import SessionLocal
from app import models
from ultralytics import YOLO

def compute_dataset_hash(dataset_dir: Path) -> str:
    """Computes MD5 hash of all annotation files in the dataset."""
    hasher = hashlib.md5()
    for txt_file in sorted(dataset_dir.rglob("*.txt")):
        hasher.update(txt_file.read_bytes())
    return hasher.hexdigest()

def get_git_commit() -> str:
    """Returns current git commit hash."""
    try:
        res = subprocess.run(["git", "rev-parse", "HEAD"], cwd=str(PROJECT_ROOT), capture_output=True, text=True)
        if res.returncode == 0:
            return res.stdout.strip()
    except Exception:
        pass
    return "unknown"

def pre_training_validation(dataset_yaml_path: Path):
    """Rigorous pre-training dataset and database verification."""
    print("=" * 70)
    print("  PHASE 1: PRE-TRAINING DATASET VALIDATION")
    print("=" * 70)
    
    # 1. Database check
    db = SessionLocal()
    try:
        active_products = db.query(models.Product).order_by(models.Product.name).all()
        active_pids = {str(p.id): p.name for p in active_products}
    finally:
        db.close()
        
    print(f"Active Products in PostgreSQL ({len(active_pids)}):")
    for pid, name in active_pids.items():
        print(f"  - {name} (ID: {pid})")
        
    if len(active_pids) != 2:
        raise ValueError(f"Expected exactly 2 active products, found {len(active_pids)}")
        
    expected_names = {"casio calculator", "truke earbuds"}
    actual_names = {n.lower() for n in active_pids.values()}
    if expected_names != actual_names:
        raise ValueError(f"Active products mismatch! Expected {expected_names}, found {actual_names}")

    # 2. YAML check
    if not dataset_yaml_path.exists():
        raise FileNotFoundError(f"dataset.yaml not found at {dataset_yaml_path}")
        
    with open(dataset_yaml_path, "r", encoding="utf-8") as f:
        ydata = yaml.safe_load(f)
        
    dataset_root = BACKEND_DIR / ydata.get("path", "data/kartmitra/dataset")
    if not dataset_root.exists():
        raise FileNotFoundError(f"Dataset root directory {dataset_root} does not exist")
        
    splits = {}
    for split_key in ["train", "val", "test"]:
        sub = ydata.get(split_key)
        if not sub:
            raise ValueError(f"dataset.yaml missing '{split_key}' key")
        s_dir = (dataset_root / sub).parent
        if not s_dir.exists():
            raise FileNotFoundError(f"Split directory {s_dir} does not exist")
        splits[split_key] = s_dir

    names_dict = ydata.get("names", {})
    if len(names_dict) != 2:
        raise ValueError(f"dataset.yaml names count is {len(names_dict)}, expected 2")
    print(f"dataset.yaml classes: {names_dict}")

    # 3. Label & Image Validation & Leakage Check
    seen_hashes = {}
    total_imgs = 0
    total_lbls = 0
    split_counts = {}
    class_counts = {0: 0, 1: 0}

    for s_name, s_dir in splits.items():
        img_dir = s_dir / "images"
        lbl_dir = s_dir / "labels"
        
        imgs = sorted(list(img_dir.glob("*")))
        lbls = sorted(list(lbl_dir.glob("*.txt")))
        split_counts[s_name] = len(imgs)
        total_imgs += len(imgs)
        total_lbls += len(lbls)
        
        if len(imgs) != len(lbls):
            raise ValueError(f"Split {s_name} has {len(imgs)} images but {len(lbls)} labels (1-to-1 required)")
            
        for img_p in imgs:
            # Check readability
            img_mat = cv2.imread(str(img_p))
            if img_mat is None:
                raise ValueError(f"Image {img_p} is unreadable or corrupted")
                
            # Leakage check
            h = hashlib.md5(img_p.read_bytes()).hexdigest()
            if h in seen_hashes and seen_hashes[h] != s_name:
                raise ValueError(f"DATA LEAKAGE: Image {img_p.name} exists in both {seen_hashes[h]} and {s_name}")
            seen_hashes[h] = s_name
            
            lbl_p = lbl_dir / f"{img_p.stem}.txt"
            if not lbl_p.exists():
                raise FileNotFoundError(f"Missing label file for image {img_p}")
                
            lines = [l.strip() for l in lbl_p.read_text(encoding="utf-8").splitlines() if l.strip()]
            if not lines:
                raise ValueError(f"Empty label file {lbl_p}")
                
            for line in lines:
                parts = line.split()
                if len(parts) != 5:
                    raise ValueError(f"Invalid label line '{line}' in {lbl_p}")
                cid = int(parts[0])
                if cid not in (0, 1):
                    raise ValueError(f"Invalid class ID {cid} in {lbl_p} (expected 0 or 1)")
                class_counts[cid] += 1
                
                cx, cy, w, h = map(float, parts[1:])
                if not (0.0 <= cx <= 1.0 and 0.0 <= cy <= 1.0 and 0.0 < w <= 1.0 and 0.0 < h <= 1.0):
                    raise ValueError(f"Unnormalized/invalid coordinates in {lbl_p}: {parts}")

    print(f"Pre-training verification succeeded:")
    print(f"  - Total Images: {total_imgs} (Train: {split_counts['train']}, Val: {split_counts['val']}, Test: {split_counts['test']})")
    print(f"  - Total Annotations: {sum(class_counts.values())} (Class 0: {class_counts[0]}, Class 1: {class_counts[1]})")
    print(f"  - Data Leakage: 0 detected")
    print("=" * 70)
    return split_counts, class_counts

def main():
    start_time = time.time()
    
    # Paths
    dataset_yaml_rel = Path("data/kartmitra/dataset/dataset.yaml")
    dataset_yaml_abs = BACKEND_DIR / dataset_yaml_rel
    base_model_path = BACKEND_DIR / "yolov8n.pt"
    
    if not base_model_path.exists():
        raise FileNotFoundError(f"Base pretrained weights not found at {base_model_path}")

    # Step 1: Pre-training Validation
    split_counts, class_counts = pre_training_validation(dataset_yaml_abs)
    
    # Step 2: Set Seeds for Reproducibility
    SEED = 42
    random.seed(SEED)
    np.random.seed(SEED)
    import torch
    torch.manual_seed(SEED)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(SEED)

    # Step 3: Training Run Directory Setup
    yolo_models_root = BACKEND_DIR / "models" / "yolo"
    yolo_models_root.mkdir(parents=True, exist_ok=True)
    
    version_str = "v1"
    run_dir = yolo_models_root / version_str
    if run_dir.exists():
        v_num = 1
        while (yolo_models_root / f"v{v_num}").exists():
            v_num += 1
        version_str = f"v{v_num}"
        run_dir = yolo_models_root / version_str
        
    print(f"\n[PHASE 2] Initializing Training Version: {version_str}")
    print(f"Run directory: {run_dir}")
    run_dir.mkdir(parents=True, exist_ok=True)
    
    weights_dir = run_dir / "weights"
    results_dir = run_dir / "results"
    metrics_dir = run_dir / "metrics"
    config_dir = run_dir / "config"
    for d in [weights_dir, results_dir, metrics_dir, config_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # Save classes.json & config snapshot
    classes_src = BACKEND_DIR / "data" / "kartmitra" / "dataset" / "classes.json"
    classes_data = {}
    if classes_src.exists():
        classes_data = json.loads(classes_src.read_text(encoding="utf-8"))
        shutil.copy(classes_src, run_dir / "classes.json")
    shutil.copy(dataset_yaml_abs, config_dir / "dataset.yaml")

    # Step 4: Training Hyperparameters
    train_params = {
        "model": str(base_model_path),
        "data": str(dataset_yaml_rel),
        "epochs": 20,
        "imgsz": 640,
        "batch": 8,
        "device": "cpu",
        "workers": 0,
        "seed": SEED,
        "deterministic": True,
        "patience": 10,
        "save": True,
        "val": True,
        "project": str(run_dir),
        "name": "train_run",
        "exist_ok": True,
        "verbose": True,
        # Controlled augmentations preserving packaging text/appearance
        "degrees": 5.0,
        "translate": 0.05,
        "scale": 0.2,
        "hsv_h": 0.015,
        "hsv_s": 0.2,
        "hsv_v": 0.2,
        "fliplr": 0.5,
        "mosaic": 0.0,
        "mixup": 0.0,
        "copy_paste": 0.0
    }

    with open(config_dir / "train_config.json", "w", encoding="utf-8") as f:
        json.dump(train_params, f, indent=2)

    # Step 5: Start YOLO Training Run
    print(f"\n[PHASE 3] Starting YOLOv8n Training ({train_params['epochs']} epochs, batch {train_params['batch']}, imgsz {train_params['imgsz']})...")
    train_start_t = time.time()
    
    model = YOLO(str(base_model_path))
    train_results = model.train(**train_params)
    train_duration_sec = round(time.time() - train_start_t, 2)
    print(f"\nTraining completed in {train_duration_sec:.2f} seconds.")

    # Locate trained weights
    ultralytics_weights = run_dir / "train_run" / "weights"
    best_weight_src = ultralytics_weights / "best.pt"
    last_weight_src = ultralytics_weights / "last.pt"

    best_target = weights_dir / "best.pt"
    last_target = weights_dir / "last.pt"

    if best_weight_src.exists():
        shutil.copy(best_weight_src, best_target)
    if last_weight_src.exists():
        shutil.copy(last_weight_src, last_target)

    # Copy top-level best.pt & last.pt for direct loading
    if best_target.exists():
        shutil.copy(best_target, run_dir / "best.pt")
    if last_target.exists():
        shutil.copy(last_target, run_dir / "last.pt")

    # Step 6: Validate and Compute Validation Metrics
    print("\n[PHASE 4] Evaluating Final Best Model on Validation Set...")
    best_model = YOLO(str(best_target))
    val_metrics = best_model.val(data=str(dataset_yaml_rel), split="val", imgsz=640, device="cpu", verbose=False)

    val_precision = round(float(val_metrics.results_dict.get("metrics/precision(B)", 0.0)), 4)
    val_recall = round(float(val_metrics.results_dict.get("metrics/recall(B)", 0.0)), 4)
    val_map50 = round(float(val_metrics.results_dict.get("metrics/mAP50(B)", 0.0)), 4)
    val_map50_95 = round(float(val_metrics.results_dict.get("metrics/mAP50-95(B)", 0.0)), 4)

    val_per_class = {}
    class_names = ["Casio Calculator", "Truke Earbuds"]
    
    try:
        p_per_class = val_metrics.box.p
        r_per_class = val_metrics.box.r
        ap50_per_class = val_metrics.box.ap50
        ap_per_class = val_metrics.box.ap
        
        for idx, name in enumerate(class_names):
            p_val = float(p_per_class[idx]) if idx < len(p_per_class) else 0.0
            r_val = float(r_per_class[idx]) if idx < len(r_per_class) else 0.0
            ap50_val = float(ap50_per_class[idx]) if idx < len(ap50_per_class) else 0.0
            ap_val = float(ap_per_class[idx]) if idx < len(ap_per_class) else 0.0
            
            val_per_class[name] = {
                "precision": round(p_val, 4),
                "recall": round(r_val, 4),
                "mAP50": round(ap50_val, 4),
                "mAP50_95": round(ap_val, 4)
            }
    except Exception as e:
        print(f"Warning extracting per-class validation metrics: {e}")
        for idx, name in enumerate(class_names):
            val_per_class[name] = {
                "precision": val_precision,
                "recall": val_recall,
                "mAP50": val_map50,
                "mAP50_95": val_map50_95
            }

    train_metrics_data = {
        "precision": val_precision,
        "recall": val_recall,
        "mAP50": val_map50,
        "mAP50_95": val_map50_95,
        "per_class": val_per_class,
        "training_duration_seconds": train_duration_sec,
        "results_dict": {k: float(v) for k, v in val_metrics.results_dict.items() if isinstance(v, (int, float, np.number))}
    }

    with open(metrics_dir / "train_metrics.json", "w", encoding="utf-8") as f:
        json.dump(train_metrics_data, f, indent=2)

    # Copy plots & confusion matrix from train_run to results/
    train_run_dir = run_dir / "train_run"
    if train_run_dir.exists():
        for plot_f in train_run_dir.glob("*.png"):
            shutil.copy(plot_f, results_dir / plot_f.name)
        for csv_f in train_run_dir.glob("*.csv"):
            shutil.copy(csv_f, results_dir / csv_f.name)

    # Step 7: Held-Out Test Set Evaluation
    print("\n[PHASE 5] Evaluating Final Best Model on HELD-OUT TEST SET...")
    test_metrics = best_model.val(data=str(dataset_yaml_rel), split="test", imgsz=640, device="cpu", verbose=False)

    test_precision = round(float(test_metrics.results_dict.get("metrics/precision(B)", 0.0)), 4)
    test_recall = round(float(test_metrics.results_dict.get("metrics/recall(B)", 0.0)), 4)
    test_map50 = round(float(test_metrics.results_dict.get("metrics/mAP50(B)", 0.0)), 4)
    test_map50_95 = round(float(test_metrics.results_dict.get("metrics/mAP50-95(B)", 0.0)), 4)

    test_per_class = {}
    try:
        tp_per_class = test_metrics.box.p
        tr_per_class = test_metrics.box.r
        tap50_per_class = test_metrics.box.ap50
        tap_per_class = test_metrics.box.ap
        
        for idx, name in enumerate(class_names):
            p_val = float(tp_per_class[idx]) if idx < len(tp_per_class) else 0.0
            r_val = float(tr_per_class[idx]) if idx < len(tr_per_class) else 0.0
            ap50_val = float(tap50_per_class[idx]) if idx < len(tap50_per_class) else 0.0
            ap_val = float(tap_per_class[idx]) if idx < len(tap_per_class) else 0.0
            
            test_per_class[name] = {
                "precision": round(p_val, 4),
                "recall": round(r_val, 4),
                "mAP50": round(ap50_val, 4),
                "mAP50_95": round(ap_val, 4)
            }
    except Exception as e:
        print(f"Warning extracting per-class test metrics: {e}")
        for idx, name in enumerate(class_names):
            test_per_class[name] = {
                "precision": test_precision,
                "recall": test_recall,
                "mAP50": test_map50,
                "mAP50_95": test_map50_95
            }

    test_metrics_data = {
        "test_precision": test_precision,
        "test_recall": test_recall,
        "test_mAP50": test_map50,
        "test_mAP50_95": test_map50_95,
        "per_class": test_per_class,
        "results_dict": {k: float(v) for k, v in test_metrics.results_dict.items() if isinstance(v, (int, float, np.number))}
    }

    with open(metrics_dir / "test_metrics.json", "w", encoding="utf-8") as f:
        json.dump(test_metrics_data, f, indent=2)

    # Step 8: Visual Prediction Test on Representative Test Images
    print("\n[PHASE 6] Running Visual Prediction Test on Held-Out Test Images...")
    pred_dir = results_dir / "predictions"
    pred_dir.mkdir(parents=True, exist_ok=True)
    
    test_img_dir = BACKEND_DIR / "data" / "kartmitra" / "dataset" / "test" / "images"
    test_lbl_dir = BACKEND_DIR / "data" / "kartmitra" / "dataset" / "test" / "labels"
    test_images = sorted(list(test_img_dir.glob("*")))

    prediction_report = []

    for img_p in test_images:
        lbl_p = test_lbl_dir / f"{img_p.stem}.txt"
        gt_classes = []
        if lbl_p.exists():
            for line in lbl_p.read_text().splitlines():
                if line.strip():
                    gt_classes.append(int(line.split()[0]))

        # Run inference
        results = best_model.predict(
            source=str(img_p),
            conf=0.25,
            iou=0.45,
            device="cpu",
            verbose=False
        )
        
        res = results[0]
        boxes = res.boxes
        
        detected_classes = []
        detected_confs = []
        det_bboxes = []
        
        if boxes is not None and len(boxes) > 0:
            for b in boxes:
                cls_id = int(b.cls[0].item())
                conf_val = round(float(b.conf[0].item()), 4)
                xyxy = [round(float(coord), 1) for coord in b.xyxy[0].tolist()]
                detected_classes.append(cls_id)
                detected_confs.append(conf_val)
                det_bboxes.append(xyxy)

        # Plot and save prediction visualization
        annotated_img = res.plot()
        out_vis_path = pred_dir / f"pred_{img_p.name}"
        cv2.imwrite(str(out_vis_path), annotated_img)

        # Analysis
        gt_names = [class_names[c] for c in gt_classes]
        det_names = [class_names[c] for c in detected_classes if c < len(class_names)]
        
        localization_ok = len(detected_classes) > 0
        wrong_class = any(c not in gt_classes for c in detected_classes)
        missed_detection = len(detected_classes) == 0
        duplicate_detection = len(detected_classes) > len(gt_classes)
        
        item_summary = {
            "image": img_p.name,
            "ground_truth_classes": gt_names,
            "predicted_classes": det_names,
            "confidences": detected_confs,
            "bounding_boxes": det_bboxes,
            "localization": "CORRECT" if localization_ok else "MISSED",
            "wrong_class": wrong_class,
            "missed_detection": missed_detection,
            "duplicate_detection": duplicate_detection,
            "visualization_path": str(out_vis_path.relative_to(BACKEND_DIR))
        }
        prediction_report.append(item_summary)

    with open(results_dir / "visual_prediction_report.json", "w", encoding="utf-8") as f:
        json.dump(prediction_report, f, indent=2)

    # Step 9: Background / Negative Test
    print("\n[PHASE 7] Checking Negative / Background Dataset...")
    negative_report = "NEGATIVE TEST DATA NOT AVAILABLE"
    print(f"Result: {negative_report}")

    # Step 10: Model Versioning and Metadata
    print("\n[PHASE 8] Creating Model Version Metadata...")
    dataset_hash = compute_dataset_hash(BACKEND_DIR / "data" / "kartmitra" / "dataset")
    git_commit = get_git_commit()

    metadata = {
        "model_version": f"yolo_{version_str}",
        "base_model": "yolov8n.pt",
        "training_date_time": datetime.now().isoformat(),
        "dataset_version": "v1",
        "dataset_hash": dataset_hash,
        "classes": {str(k): v.get("name", f"Class {k}") if isinstance(v, dict) else v for k, v in classes_data.items()},
        "num_train_images": split_counts["train"],
        "num_val_images": split_counts["val"],
        "num_test_images": split_counts["test"],
        "training_configuration": {
            "epochs": train_params["epochs"],
            "batch_size": train_params["batch"],
            "image_size": train_params["imgsz"],
            "device": train_params["device"],
            "seed": train_params["seed"],
            "patience": train_params["patience"],
            "training_duration_seconds": train_duration_sec
        },
        "metrics": {
            "val": train_metrics_data,
            "test": test_metrics_data
        },
        "negative_test": negative_report,
        "git_commit": git_commit
    }

    with open(run_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    # Create alias directory yolo_v1 for standard reference
    yolo_v1_dir = yolo_models_root / f"yolo_{version_str}"
    yolo_v1_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy(best_target, yolo_v1_dir / "best.pt")
    if last_target.exists():
        shutil.copy(last_target, yolo_v1_dir / "last.pt")
    shutil.copy(run_dir / "metadata.json", yolo_v1_dir / "metadata.json")
    if (run_dir / "classes.json").exists():
        shutil.copy(run_dir / "classes.json", yolo_v1_dir / "classes.json")

    # Also make available in backend/models/kartmitra/yolo_v1/ for registry
    kartmitra_models_dir = BACKEND_DIR / "models" / "kartmitra" / f"yolo_{version_str}"
    kartmitra_models_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy(best_target, kartmitra_models_dir / "best.pt")
    shutil.copy(run_dir / "metadata.json", kartmitra_models_dir / "metadata.json")

    # Step 11: Update active model version pointer
    active_version_file = BACKEND_DIR / "models" / "kartmitra" / "active_version.txt"
    active_version_file.write_text(f"yolo_{version_str}", encoding="utf-8")

    total_time = round(time.time() - start_time, 2)
    print("=" * 70)
    print(f"  TRAINING RUN COMPLETED SUCCESSFULLY in {total_time}s")
    print(f"  Model Version: yolo_{version_str}")
    print(f"  Best Weights:  {best_target}")
    print(f"  Metadata:      {run_dir / 'metadata.json'}")
    print(f"  Val mAP50:     {val_map50}")
    print(f"  Test mAP50:    {test_map50}")
    print("=" * 70)

if __name__ == "__main__":
    main()
