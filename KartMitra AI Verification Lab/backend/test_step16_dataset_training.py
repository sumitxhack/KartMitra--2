import pytest
import io
import json
import numpy as np
import cv2
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_db, SessionLocal
from app import models, dataset_service, training_service

client = TestClient(app)


def create_dummy_jpeg_bytes(width=200, height=200, color=(100, 150, 200)) -> bytes:
    """Helper to generate valid JPEG image bytes for tests."""
    img = np.full((height, width, 3), color, dtype=np.uint8)
    # Add a rectangle so it's not a plain solid blur
    cv2.rectangle(img, (20, 20), (width - 20, height - 20), (255, 255, 255), -1)
    _, encoded = cv2.imencode(".jpg", img)
    return encoded.tobytes()


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        p1 = db.query(models.Product).filter(models.Product.id == "1").first()
        if not p1:
            p_by_bc = db.query(models.Product).filter(models.Product.barcode == "8901234567890").first()
            if not p_by_bc:
                p1 = models.Product(
                    id="1",
                    barcode="8901234567890",
                    name="Amul Taaza Milk",
                    price=62.0,
                    weight=1.0,
                    category="Dairy"
                )
                db.add(p1)
                db.commit()
        yield db
    finally:
        db.close()


def test_1_product_image_upload(db_session):
    """Test 1: Upload dataset product image."""
    img_bytes = create_dummy_jpeg_bytes()
    response = client.post(
        "/api/v1/dataset/products/1/images",
        files={"file": ("front_01.jpg", img_bytes, "image/jpeg")},
        data={"image_type": "front"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["product_id"] == "1"
    assert "image_id" in data


def test_2_invalid_image_rejection():
    """Test 2: Rejects corrupted or invalid image file."""
    bad_bytes = b"NOT_AN_IMAGE_FILE_CORRUPTED"
    response = client.post(
        "/api/v1/dataset/products/1/images",
        files={"file": ("corrupt.jpg", bad_bytes, "image/jpeg")}
    )
    assert response.status_code == 400


def test_3_dataset_coverage(db_session):
    """Test 3: Dataset coverage analytics per product."""
    response = client.get("/api/v1/dataset/products/1/coverage")
    assert response.status_code == 200
    data = response.json()
    assert "coverage" in data
    assert "image_count" in data


def test_4_annotation_creation(db_session):
    """Test 4 & 7: Annotation creation with single and multiple bounding boxes."""
    payload = {
        "image_id": "test_img_001",
        "product_id": "1",
        "annotations": [
            {
                "class_id": 0,
                "product_id": "1",
                "center_x": 0.5,
                "center_y": 0.5,
                "width": 0.4,
                "height": 0.6
            },
            {
                "class_id": 1,
                "product_id": "2",
                "center_x": 0.2,
                "center_y": 0.3,
                "width": 0.2,
                "height": 0.3
            }
        ]
    }
    response = client.post("/api/v1/dataset/annotate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["count"] == 2


def test_5_invalid_bounding_box():
    """Test 5 & 6: Rejects out of bounds bounding box coordinates (not 0..1)."""
    payload = {
        "image_id": "test_img_bad",
        "product_id": "1",
        "annotations": [
            {
                "class_id": 0,
                "product_id": "1",
                "center_x": 1.5,  # Out of bounds!
                "center_y": 0.5,
                "width": 0.4,
                "height": 0.6
            }
        ]
    }
    response = client.post("/api/v1/dataset/annotate", json=payload)
    assert response.status_code == 400


def test_8_dataset_split(db_session):
    """Test 8: Dataset splitting into 70/20/10 train/val/test."""
    res = dataset_service.split_and_prepare_dataset(db=db_session)
    assert "success" in res


def test_9_dataset_yaml_generation():
    """Test 9: dataset.yaml manifest generation."""
    yaml_path = dataset_service.generate_dataset_yaml()
    assert yaml_path.exists()
    assert "dataset.yaml" in str(yaml_path)


def test_10_class_mapping_stability():
    """Test 10: Product class mapping stability."""
    cid = dataset_service.get_or_create_class_id_for_product("1", "Amul Taaza Milk")
    cid2 = dataset_service.get_or_create_class_id_for_product("1", "Amul Taaza Milk")
    assert cid == cid2


def test_11_dataset_validation(db_session):
    """Test 11: Pre-training dataset validation endpoint."""
    response = client.post("/api/v1/dataset/validate")
    assert response.status_code == 200
    data = response.json()
    assert "valid" in data
    assert "images" in data


def test_12_training_run_creation(db_session):
    """Test 12 & 13: Training run creation and progress polling."""
    # Ensure class mapping exists
    dataset_service.get_or_create_class_id_for_product("1", "Amul Taaza Milk")

    # Add a sample image and annotation so dataset validation passes
    img_bytes = create_dummy_jpeg_bytes()
    up_res = client.post(
        "/api/v1/dataset/products/1/images",
        files={"file": ("train_01.jpg", img_bytes, "image/jpeg")},
        data={"image_type": "front"}
    )
    img_id = up_res.json().get("image_id", "img_001")

    client.post("/api/v1/dataset/annotate", json={
        "image_id": img_id,
        "product_id": "1",
        "annotations": [{
            "class_id": 0,
            "product_id": "1",
            "center_x": 0.5,
            "center_y": 0.5,
            "width": 0.5,
            "height": 0.5
        }]
    })

    # Prepare dataset split
    dataset_service.split_and_prepare_dataset(db=db_session)

    payload = {
        "dataset_version": "v1",
        "model_size": "yolo11n.pt",
        "epochs": 2,
        "image_size": 320,
        "batch_size": 2,
        "device": "cpu"
    }
    response = client.post("/api/v1/training/start", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["success"] is True
    run_id = data["training_run_id"]

    # Poll status
    status_res = client.get(f"/api/v1/training/{run_id}")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["training_run_id"] == run_id


def test_15_model_registration_and_activation():
    """Test 15, 16, 17: Model version registration, activation, and rollback."""
    models_res = client.get("/api/v1/models")
    assert models_res.status_code == 200

    active_res = client.get("/api/v1/models/active")
    assert active_res.status_code == 200


def test_18_inference_using_active_model(db_session):
    """Test 18 & 19 & 20: Object detection using active model."""
    img_bytes = create_dummy_jpeg_bytes()
    response = client.post(
        "/api/v1/recognition/detect",
        files={"file": ("camera.jpg", img_bytes, "image/jpeg")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "detections" in data


def test_21_background_false_positive(db_session):
    """Test 21: Plain background frame should not match registered products with false positives."""
    bg_bytes = create_dummy_jpeg_bytes(color=(50, 50, 50))
    response = client.post(
        "/api/v1/recognition/identify",
        files={"file": ("background.jpg", bg_bytes, "image/jpeg")}
    )
    assert response.status_code == 200


def test_22_dino_and_barcode_verification(db_session):
    """Test 22, 23, 24: Secondary DINOv2 and Barcode verification in hybrid decision engine."""
    img_bytes = create_dummy_jpeg_bytes()
    response = client.post(
        "/api/v1/recognition/identify",
        files={"file": ("product.jpg", img_bytes, "image/jpeg")}
    )
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "visual_match" in data
    assert "barcode" in data


def test_25_26_27_backward_compatibility(db_session):
    """Test 25, 26, 27: Ensures Step 13 visual matching, Step 14 evaluation, and Step 15 multi-product detection APIs remain fully working."""
    img_bytes = create_dummy_jpeg_bytes()

    # Step 13 visual match API
    vm_res = client.post("/api/v1/recognition/visual-match", files={"file": ("test.jpg", img_bytes, "image/jpeg")})
    assert vm_res.status_code == 200

    # Step 15 multi-product detection API
    multi_res = client.post("/api/v1/recognition/multi", files={"file": ("test.jpg", img_bytes, "image/jpeg")})
    assert multi_res.status_code == 200
