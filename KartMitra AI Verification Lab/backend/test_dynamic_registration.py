import io
import os
import cv2
import json
import pytest
import numpy as np
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.db import SessionLocal, Base, engine
from app import models, crud, config
from app.visual_index_service import get_visual_index, validate_index_consistency
from app.visual_embedding_service import is_embedding_model_ready, DummyEmbeddingModel
from app.visual_registry_service import index_product_images, remove_product_from_index, build_product_visual_registry
from app.recognition_service import perform_visual_matching

client = TestClient(app)


def create_test_image_bytes(seed_id: int = 1, text: str = "Test", width=300, height=300) -> bytes:
    """Generates synthetic RGB JPEG with high-contrast, varied geometric patterns to ensure distinct perceptual hashes."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:, :] = (seed_id * 37 % 200, seed_id * 59 % 200, seed_id * 83 % 200)
    cx = (seed_id * 47) % (width - 100) + 50
    cy = (seed_id * 61) % (height - 100) + 50
    r = 20 + (seed_id * 11) % 40
    cv2.circle(img, (cx, cy), r, (255, 255, 255), -1)
    cv2.rectangle(img, (cx - r // 2, cy - r // 2), (cx + r, cy + r), (0, 255, 0), 3)
    cv2.line(img, (0, (seed_id * 23) % height), (width, height - (seed_id * 19) % height), (255, 0, 255), 4)
    cv2.putText(img, f"{text}_{seed_id}", (20, height // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    _, buffer = cv2.imencode(".jpg", img)
    return buffer.tobytes()


class TestDynamicProductRegistrationSuite:
    @classmethod
    def setup_class(cls):
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()
        assert is_embedding_model_ready(), "DINOv2 real model must be loaded and ready for production testing."

        cls.classes_file = config.DATASET_BASE_DIR / "dataset" / "classes.json"
        cls.yaml_file = config.DATASET_BASE_DIR / "dataset" / "dataset.yaml"
        cls.initial_classes_content = cls.classes_file.read_text(encoding="utf-8") if cls.classes_file.exists() else ""
        cls.initial_yaml_content = cls.yaml_file.read_text(encoding="utf-8") if cls.yaml_file.exists() else ""

        idx, meta = get_visual_index()
        cls.baseline_vector_count = idx.ntotal
        print(f"\n[Test Suite] Baseline FAISS vectors: {cls.baseline_vector_count}")

    @classmethod
    def teardown_class(cls):
        build_product_visual_registry(cls.db)
        cls.db.close()

    def test_A_create_product_without_images(self):
        payload = {
            "barcode": "8909999000011",
            "name": "Generic Test AirPods",
            "price": 9999.0,
            "weight": 0.05,
            "category": "Electronics",
            "description": "True wireless earbuds"
        }
        res = client.post("/api/v1/products", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["success"] is True
        product = data["product"]
        prod_id = product["id"]

        try:
            assert product["indexing_status"] == "PENDING"
            idx, _ = get_visual_index()
            assert idx.ntotal == self.baseline_vector_count

            status_res = client.get(f"/api/v1/products/{prod_id}/index-status")
            assert status_res.status_code == 200
            sdata = status_res.json()
            assert sdata["status"] == "PENDING"
            assert sdata["total_images"] == 0
            assert sdata["indexed_images"] == 0
        finally:
            client.delete(f"/api/v1/products/{prod_id}")

    def test_B_create_product_with_one_image(self):
        idx_before, _ = get_visual_index()
        cnt_before = idx_before.ntotal

        res = client.post("/api/v1/products", json={
            "barcode": "8909999000022",
            "name": "Single Image Test Product",
            "price": 499.0,
            "weight": 0.25,
            "category": "Stationery"
        })
        assert res.status_code == 200
        prod_id = res.json()["product"]["id"]

        try:
            img_bytes = create_test_image_bytes(1, "Single 1")
            upload_res = client.post(
                f"/api/v1/products/{prod_id}/images",
                data={"image_type": "front"},
                files={"file": ("front.jpg", img_bytes, "image/jpeg")}
            )
            assert upload_res.status_code == 200
            assert upload_res.json()["success"] is True

            idx_after, meta_after = get_visual_index()
            assert idx_after.ntotal == cnt_before + 1
            assert len(meta_after) == cnt_before + 1

            status_res = client.get(f"/api/v1/products/{prod_id}/index-status")
            assert status_res.json()["status"] == "READY"
            assert status_res.json()["indexed_images"] == 1
        finally:
            client.delete(f"/api/v1/products/{prod_id}")

    def test_C_D_E_F_G_create_product_with_multiple_images_and_real_dinov2(self):
        idx_before, _ = get_visual_index()
        cnt_before = idx_before.ntotal

        res = client.post("/api/v1/products", json={
            "barcode": "8909999000033",
            "name": "Apple AirPods Test Edition",
            "price": 19999.0,
            "weight": 0.06,
            "category": "Electronics",
            "description": "Wireless noise cancelling earbuds"
        })
        assert res.status_code == 200
        prod_id = res.json()["product"]["id"]

        try:
            files_to_send = [
                ("files", (f"angle_{i}.jpg", create_test_image_bytes(i, f"AirPods_{i}"), "image/jpeg"))
                for i in range(1, 6)
            ]

            batch_res = client.post(
                f"/api/v1/products/{prod_id}/images/batch",
                data={"image_type": "angled"},
                files=files_to_send
            )
            assert batch_res.status_code == 200, batch_res.text
            bdata = batch_res.json()
            assert bdata["success"] is True
            assert bdata["uploaded_count"] == 5
            assert bdata["indexing_status"] == "READY"

            idx_after, meta_after = get_visual_index()
            assert idx_after.ntotal == cnt_before + 5
            assert len(meta_after) == cnt_before + 5

            matching_meta = [m for m in meta_after if m.get("product_id") == prod_id]
            assert len(matching_meta) == 5
            for m in matching_meta:
                assert m["embedding_dimension"] == 384
                assert m["model_name"] == "facebook/dinov2-small"
                assert m["image_path"] is not None
                assert not os.path.isabs(m["image_path"])

            embs = crud.get_embeddings_for_product(self.db, prod_id)
            assert len(embs) == 5
            meta_img_ids = {m["product_image_id"] for m in matching_meta}
            db_img_ids = {e.product_image_id for e in embs}
            assert meta_img_ids == db_img_ids
        finally:
            client.delete(f"/api/v1/products/{prod_id}")

    def test_H_idempotency_no_duplicate_vectors(self):
        res = client.post("/api/v1/products", json={
            "barcode": "8909999000044",
            "name": "Idempotent Indexing Product",
            "price": 120.0,
            "weight": 0.10
        })
        prod_id = res.json()["product"]["id"]

        try:
            client.post(
                f"/api/v1/products/{prod_id}/images",
                data={"image_type": "front"},
                files={"file": ("front.jpg", create_test_image_bytes(11, "Idempotent 1"), "image/jpeg")}
            )
            client.post(
                f"/api/v1/products/{prod_id}/images",
                data={"image_type": "back"},
                files={"file": ("back.jpg", create_test_image_bytes(12, "Idempotent 2"), "image/jpeg")}
            )

            idx1, _ = get_visual_index()
            count_after_first_index = idx1.ntotal

            reindex_res = client.post(f"/api/v1/products/{prod_id}/index")
            assert reindex_res.status_code == 200
            assert reindex_res.json()["status"] == "READY"
            assert reindex_res.json()["embeddings_created"] == 0

            idx2, _ = get_visual_index()
            assert idx2.ntotal == count_after_first_index

            index_product_images(prod_id, self.db)
            idx3, _ = get_visual_index()
            assert idx3.ntotal == count_after_first_index
        finally:
            client.delete(f"/api/v1/products/{prod_id}")

    def test_I_adding_additional_images_only_indexes_new_images(self):
        res = client.post("/api/v1/products", json={
            "barcode": "8909999000055",
            "name": "Incremental Product Update",
            "price": 750.0,
            "weight": 0.35
        })
        prod_id = res.json()["product"]["id"]

        try:
            client.post(
                f"/api/v1/products/{prod_id}/images",
                data={"image_type": "front"},
                files={"file": ("img1.jpg", create_test_image_bytes(21, "Initial 1"), "image/jpeg")}
            )
            client.post(
                f"/api/v1/products/{prod_id}/images",
                data={"image_type": "back"},
                files={"file": ("img2.jpg", create_test_image_bytes(22, "Initial 2"), "image/jpeg")}
            )

            idx1, meta1 = get_visual_index()
            count_initial = idx1.ntotal
            initial_p_ids = [m["faiss_index_id"] for m in meta1 if m.get("product_id") == prod_id]
            assert len(initial_p_ids) == 2

            upload2 = client.post(
                f"/api/v1/products/{prod_id}/images",
                data={"image_type": "side"},
                files={"file": ("img3.jpg", create_test_image_bytes(23, "Additional 3"), "image/jpeg")}
            )
            assert upload2.status_code == 200

            idx2, meta2 = get_visual_index()
            assert idx2.ntotal == count_initial + 1
            updated_p_ids = [m["faiss_index_id"] for m in meta2 if m.get("product_id") == prod_id]
            assert len(updated_p_ids) == 3
            for orig_id in initial_p_ids:
                assert orig_id in updated_p_ids
        finally:
            client.delete(f"/api/v1/products/{prod_id}")

    def test_J_deleted_image_removes_faiss_metadata_and_vector(self):
        res = client.post("/api/v1/products", json={
            "barcode": "8909999000066",
            "name": "Image Deletion Test Product",
            "price": 350.0,
            "weight": 0.20
        })
        prod_id = res.json()["product"]["id"]

        try:
            up1 = client.post(
                f"/api/v1/products/{prod_id}/images",
                data={"image_type": "front"},
                files={"file": ("img1.jpg", create_test_image_bytes(31, "Delete Me 1"), "image/jpeg")}
            )
            up2 = client.post(
                f"/api/v1/products/{prod_id}/images",
                data={"image_type": "back"},
                files={"file": ("img2.jpg", create_test_image_bytes(32, "Keep Me 2"), "image/jpeg")}
            )
            img1_id = up1.json()["image"]["id"]
            img2_id = up2.json()["image"]["id"]

            idx_before, _ = get_visual_index()
            cnt_before = idx_before.ntotal

            del_res = client.delete(f"/api/v1/products/{prod_id}/images/{img1_id}")
            assert del_res.status_code == 200

            idx_after, meta_after = get_visual_index()
            assert idx_after.ntotal == cnt_before - 1
            assert len(meta_after) == cnt_before - 1

            remaining_img_ids = {m.get("product_image_id") for m in meta_after}
            assert img1_id not in remaining_img_ids
            assert img2_id in remaining_img_ids
        finally:
            client.delete(f"/api/v1/products/{prod_id}")

    def test_K_L_visual_similarity_search_and_clean_product_deletion(self):
        res = client.post("/api/v1/products", json={
            "barcode": "8909999000077",
            "name": "Live Search Test Headset",
            "price": 2499.0,
            "weight": 0.30,
            "category": "Electronics"
        })
        prod_id = res.json()["product"]["id"]

        test_photo_bytes = create_test_image_bytes(41, "Unique Headset VIP")

        try:
            client.post(
                f"/api/v1/products/{prod_id}/images",
                data={"image_type": "front"},
                files={"file": ("front.jpg", test_photo_bytes, "image/jpeg")}
            )

            match_res = perform_visual_matching(test_photo_bytes, db=self.db)
            assert match_res["success"] is True
            assert match_res["best_match"] is not None
            assert match_res["best_match"]["product_id"] == prod_id
            assert match_res["best_match"]["similarity"] >= 0.85
            assert match_res["visual_match"]["decision"] == "MATCH"

            http_match = client.post(
                "/api/v1/recognition/visual-match",
                files={"file": ("query.jpg", test_photo_bytes, "image/jpeg")}
            )
            assert http_match.status_code == 200
            assert http_match.json()["best_match"]["product_id"] == prod_id

            del_res = client.delete(f"/api/v1/products/{prod_id}")
            assert del_res.status_code == 200

            _, meta_after_del = get_visual_index()
            pids_in_meta = {m.get("product_id") for m in meta_after_del}
            assert prod_id not in pids_in_meta

            match_after_del = perform_visual_matching(test_photo_bytes, db=self.db)
            best_after = match_after_del.get("best_match")
            if best_after:
                assert best_after["product_id"] != prod_id
        except Exception:
            client.delete(f"/api/v1/products/{prod_id}")
            raise

    def test_M_failed_embedding_handled_safely(self):
        res = client.post("/api/v1/products", json={
            "barcode": "8909999000088",
            "name": "Fault Tolerance Product",
            "price": 199.0,
            "weight": 0.15
        })
        prod_id = res.json()["product"]["id"]

        try:
            crud.create_product_image(
                db=self.db,
                product_id=prod_id,
                image_path="/uploads/non_existent_file_xyz.jpg",
                image_type="front"
            )

            idx_res = client.post(f"/api/v1/products/{prod_id}/index")
            assert idx_res.status_code in (200, 500)

            st_res = client.get(f"/api/v1/products/{prod_id}/index-status")
            assert st_res.status_code == 200
            sdata = st_res.json()
            assert sdata["status"] == "FAILED"
            assert sdata["error"] is not None
        finally:
            client.delete(f"/api/v1/products/{prod_id}")

    def test_N_existing_products_remain_searchable(self):
        stats = validate_index_consistency(self.db)
        assert stats["is_consistent"] is True
        assert stats["postgres_active_products"] >= 2
        assert stats["faiss_vector_count"] >= 100

        casio = crud.get_product_by_barcode(self.db, "8901234567890") or crud.get_product_by_barcode(self.db, "4971850182238")
        if casio:
            assert casio.name is not None

    def test_O_YOLO_v1_is_not_modified(self):
        if self.classes_file.exists():
            current_classes = self.classes_file.read_text(encoding="utf-8")
            assert current_classes == self.initial_classes_content, "CRITICAL: classes.json was modified!"

        if self.yaml_file.exists():
            current_yaml = self.yaml_file.read_text(encoding="utf-8")
            assert current_yaml == self.initial_yaml_content, "CRITICAL: dataset.yaml was modified!"

    def test_P_Q_R_barcode_verification_and_consistency(self):
        bc_res = client.post("/api/v1/recognition/barcode", files={"file": ("test.png", create_test_image_bytes(51, "Barcode"), "image/png")})
        assert bc_res.status_code == 200

        val_res = client.get("/api/v1/visual-registry/consistency")
        assert val_res.status_code == 200
        val_data = val_res.json()
        assert val_data["success"] is True
        assert val_data["is_consistent"] is True
        assert val_data["stale_vectors"] == 0
        assert val_data["missing_vectors"] == 0
        assert val_data["duplicate_vectors"] == 0
        assert val_data["deleted_product_vectors"] == 0
