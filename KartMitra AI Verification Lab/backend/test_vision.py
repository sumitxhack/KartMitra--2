import unittest
import numpy as np
import cv2
from pathlib import Path
from app.vision_service import detect_products_from_bytes, get_yolo_model
from app import config

BASE_DIR = Path(__file__).resolve().parent

class TestYOLOVisionService(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Create a test synthetic image (bottle shape)
        cls.test_img_path = BASE_DIR / "unit_test_sample.jpg"
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        img[:] = (245, 245, 245)
        # Draw object shape
        cv2.rectangle(img, (150, 100), (350, 400), (200, 100, 50), -1)
        cv2.putText(img, "KartMitra Product", (160, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.imwrite(str(cls.test_img_path), img)

        with open(cls.test_img_path, "rb") as f:
            cls.test_image_bytes = f.read()

    def test_01_yolo_model_loader(self):
        model = get_yolo_model()
        self.assertIsNotNone(model)
        self.assertTrue(hasattr(model, "predict"))

    def test_02_detect_products_from_bytes_structure(self):
        result = detect_products_from_bytes(self.test_image_bytes)
        self.assertTrue(result.get("success"))
        self.assertIn("detections", result)
        self.assertIsInstance(result["detections"], list)

    def test_03_bounding_box_and_unknown_handling(self):
        # Even if synthetic image has no COCO object or has an object, test detection structure
        result = detect_products_from_bytes(self.test_image_bytes, conf_threshold=0.01)
        self.assertTrue(result.get("success"))
        detections = result.get("detections", [])

        for det in detections:
            self.assertIn("product_id", det)
            self.assertIn("name", det)
            self.assertIn("confidence", det)
            self.assertIn("bounding_box", det)

            box = det["bounding_box"]
            self.assertIn("x", box)
            self.assertIn("y", box)
            self.assertIn("width", box)
            self.assertIn("height", box)
            self.assertGreater(box["width"], 0)
            self.assertGreater(box["height"], 0)

    def test_04_config_settings(self):
        self.assertTrue(hasattr(config, "MODEL_PATH"))
        self.assertTrue(hasattr(config, "CONFIDENCE_THRESHOLD"))
        self.assertTrue(hasattr(config, "IOU_THRESHOLD"))
        self.assertIsInstance(config.CONFIDENCE_THRESHOLD, float)
        self.assertIsInstance(config.IOU_THRESHOLD, float)

    def test_05_visual_feature_matcher_module(self):
        from app.feature_matcher import extract_features, compute_visual_similarity
        # Generate two synthetic images
        img1 = np.full((100, 100, 3), (255, 0, 0), dtype=np.uint8)
        img2 = np.full((100, 100, 3), (250, 5, 5), dtype=np.uint8)
        img3 = np.full((100, 100, 3), (0, 255, 0), dtype=np.uint8)

        des1, hist1 = extract_features(img1)
        des2, hist2 = extract_features(img2)
        des3, hist3 = extract_features(img3)

        sim_high = compute_visual_similarity(des1, hist1, des2, hist2)
        sim_low = compute_visual_similarity(des1, hist1, des3, hist3)

        self.assertGreater(sim_high, sim_low)

if __name__ == "__main__":
    unittest.main()

