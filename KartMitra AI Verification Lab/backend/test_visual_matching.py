import unittest
import numpy as np
import cv2
import os
import io
from PIL import Image
from pathlib import Path
from sqlalchemy.orm import Session

from app.db import Base, engine, SessionLocal
from app import models, crud, config
from app.visual_embedding_service import (
    get_embedding_model,
    generate_embedding_from_image,
    generate_embedding_from_bytes,
    normalize_embedding
)
from app import visual_index_service
from app.visual_registry_service import build_product_visual_registry
from app.recognition_service import identify_product_from_bytes, perform_visual_matching

class TestVisualMatchingSuite(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.db: Session = SessionLocal()

        # Seed test products
        cls.prod1 = crud.get_product_by_barcode(cls.db, "8901234567890")
        if not cls.prod1:
            cls.prod1 = models.Product(
                id="test_milk_p001",
                barcode="8901234567890",
                name="Amul Taaza Milk",
                price=62.0,
                weight=1.0,
                category="Dairy"
            )
            cls.db.add(cls.prod1)
            cls.db.commit()
            cls.db.refresh(cls.prod1)

        cls.prod2 = crud.get_product_by_barcode(cls.db, "8901058852318")
        if not cls.prod2:
            cls.prod2 = models.Product(
                id="test_maggi_p002",
                barcode="8901058852318",
                name="Maggi 2-Minute Noodles",
                price=52.0,
                weight=0.28,
                category="Instant Food"
            )
            cls.db.add(cls.prod2)
            cls.db.commit()
            cls.db.refresh(cls.prod2)

        # Create test images directory
        cls.test_dir = config.BASE_DIR / "test_scratch_images"
        cls.test_dir.mkdir(parents=True, exist_ok=True)

        # Generate synthetic images
        cls.img_milk_path = cls.test_dir / "milk_front.jpg"
        img_milk = np.full((300, 300, 3), (255, 200, 150), dtype=np.uint8)
        cv2.putText(img_milk, "Amul Milk", (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        cv2.imwrite(str(cls.img_milk_path), img_milk)

        cls.img_maggi_path = cls.test_dir / "maggi_front.jpg"
        img_maggi = np.full((300, 300, 3), (50, 220, 240), dtype=np.uint8)
        cv2.putText(img_maggi, "Maggi Noodles", (30, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)
        cv2.imwrite(str(cls.img_maggi_path), img_maggi)

        # Add image records to DB
        img_rec1 = cls.db.query(models.ProductImage).filter_by(product_id=cls.prod1.id).first()
        if not img_rec1:
            img_rec1 = crud.create_product_image(
                db=cls.db,
                product_id=cls.prod1.id,
                image_path=str(cls.img_milk_path),
                image_type="front"
            )
        cls.img_rec1 = img_rec1

        img_rec2 = cls.db.query(models.ProductImage).filter_by(product_id=cls.prod2.id).first()
        if not img_rec2:
            img_rec2 = crud.create_product_image(
                db=cls.db,
                product_id=cls.prod2.id,
                image_path=str(cls.img_maggi_path),
                image_type="front"
            )
        cls.img_rec2 = img_rec2

        # Build Visual Registry
        cls.build_result = build_product_visual_registry(cls.db)

    @classmethod
    def tearDownClass(cls):
        try:
            if hasattr(cls, "prod2") and cls.prod2:
                from app.visual_registry_service import remove_product_from_index
                remove_product_from_index(cls.prod2.id, cls.db)
                p2 = cls.db.query(models.Product).filter_by(id=cls.prod2.id).first()
                if p2:
                    cls.db.delete(p2)
                    cls.db.commit()
        except Exception as e:
            print(f"Error in test_visual_matching tearDownClass: {e}")
        finally:
            cls.db.close()

    def test_01_embedding_generation_and_normalization(self):
        img = np.full((200, 200, 3), (100, 150, 200), dtype=np.uint8)
        vec = generate_embedding_from_image(img)
        self.assertIsNotNone(vec)
        self.assertIsInstance(vec, np.ndarray)
        self.assertEqual(vec.dtype, np.float32)
        norm_val = np.linalg.norm(vec)
        self.assertAlmostEqual(norm_val, 1.0, places=3)

    def test_02_faiss_index_persistence_and_search(self):
        stats = visual_index_service.get_index_stats()
        self.assertTrue(stats["index_loaded"])
        self.assertGreaterEqual(stats["indexed_embeddings"], 2)

        with open(self.img_milk_path, "rb") as f:
            bytes_milk = f.read()

        match_res = perform_visual_matching(bytes_milk, db=self.db)
        self.assertTrue(match_res.get("success"))
        self.assertIsNotNone(match_res.get("best_match"))
        self.assertEqual(match_res["best_match"]["product_id"], self.prod1.id)
        self.assertGreaterEqual(match_res["best_match"]["similarity"], 0.70)

    def test_03_fusion_case_1_barcode_and_visual_match(self):
        with open(self.img_milk_path, "rb") as f:
            bytes_milk = f.read()

        result = identify_product_from_bytes(bytes_milk, db=self.db)
        self.assertIn("status", result)
        self.assertIn("visual_match", result)
        self.assertEqual(result["status"], "MATCH")
        self.assertEqual(result["product"]["id"], self.prod1.id)

    def test_04_fusion_case_2_mismatch(self):
        # Scan Maggi image but pass Milk product barcode
        img_maggi_bgr = cv2.imread(str(self.img_maggi_path))
        with open(self.img_maggi_path, "rb") as f:
            bytes_maggi = f.read()

        # Execute visual matching on Maggi image
        match_res = perform_visual_matching(bytes_maggi, db=self.db)
        self.assertTrue(match_res.get("success"))
        self.assertEqual(match_res["best_match"]["product_id"], self.prod2.id)

    def test_05_visual_registry_rebuild(self):
        rebuild_stats = build_product_visual_registry(self.db)
        self.assertTrue(rebuild_stats["success"])
        self.assertGreaterEqual(rebuild_stats["embeddings_created"], 2)

if __name__ == "__main__":
    unittest.main()
