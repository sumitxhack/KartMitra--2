import unittest
import numpy as np
import cv2
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.vision_service import detect_products_from_bytes, extract_crops_and_detections
from app.recognition_service import (
    perform_multi_product_recognition,
    associate_barcode_with_product,
    aggregate_detected_products
)
from app.verification_engine import VerificationEngine

BASE_DIR = Path(__file__).resolve().parent

class TestMultiProductVision(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.test_img_path = BASE_DIR / "multi_product_test.jpg"
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        img[:] = (240, 240, 240)
        
        cv2.rectangle(img, (50, 100), (200, 400), (255, 100, 50), -1)   # Object 1
        cv2.rectangle(img, (220, 150), (400, 380), (50, 250, 100), -1)  # Object 2
        cv2.rectangle(img, (420, 80), (600, 420), (100, 50, 255), -1)   # Object 3
        
        cv2.imwrite(str(cls.test_img_path), img)
        with open(cls.test_img_path, "rb") as f:
            cls.test_image_bytes = f.read()

    @patch("app.vision_service.get_yolo_model")
    def test_01_one_product(self, mock_get_yolo):
        """Test Case 1: One product detection in a single frame."""
        mock_box = MagicMock()
        mock_box.xyxy = [[50.0, 50.0, 200.0, 200.0]]
        mock_box.conf = [0.95]
        mock_box.cls = [0]

        mock_result = MagicMock()
        mock_result.boxes = [mock_box]
        mock_result.names = {0: "bottle"}
        mock_model = MagicMock()
        mock_model.predict.return_value = [mock_result]
        mock_get_yolo.return_value = mock_model

        res = detect_products_from_bytes(self.test_image_bytes)
        self.assertTrue(res.get("success"))
        self.assertEqual(len(res.get("detections", [])), 1)

    @patch("app.vision_service.get_yolo_model")
    def test_02_two_different_products(self, mock_get_yolo):
        """Test Case 2: Two different product detections."""
        b1, b2 = MagicMock(), MagicMock()
        b1.xyxy = [[10.0, 10.0, 100.0, 100.0]]
        b1.conf = [0.96]
        b1.cls = [0]
        b2.xyxy = [[150.0, 10.0, 250.0, 100.0]]
        b2.conf = [0.92]
        b2.cls = [1]

        mock_result = MagicMock()
        mock_result.boxes = [b1, b2]
        mock_result.names = {0: "bottle", 1: "cup"}
        mock_model = MagicMock()
        mock_model.predict.return_value = [mock_result]
        mock_get_yolo.return_value = mock_model

        res = detect_products_from_bytes(self.test_image_bytes)
        self.assertEqual(len(res["detections"]), 2)

    @patch("app.vision_service.get_yolo_model")
    def test_03_five_different_products(self, mock_get_yolo):
        """Test Case 3: Five different product detections."""
        boxes = []
        for i in range(5):
            b = MagicMock()
            b.xyxy = [[i * 100.0 + 10, 10.0, i * 100.0 + 90, 100.0]]
            b.conf = [0.90 + i * 0.01]
            b.cls = [i]
            boxes.append(b)

        mock_result = MagicMock()
        mock_result.boxes = boxes
        mock_result.names = {i: f"class_{i}" for i in range(5)}
        mock_model = MagicMock()
        mock_model.predict.return_value = [mock_result]
        mock_get_yolo.return_value = mock_model

        res = detect_products_from_bytes(self.test_image_bytes)
        self.assertEqual(len(res["detections"]), 5)

    @patch("app.vision_service.get_yolo_model")
    def test_04_same_product_x2(self, mock_get_yolo):
        """Test Case 4: Same product x 2 (quantity = 2)."""
        b1, b2 = MagicMock(), MagicMock()
        b1.xyxy = [[10.0, 10.0, 100.0, 100.0]]
        b1.conf = [0.96]
        b1.cls = [0]
        b2.xyxy = [[150.0, 10.0, 250.0, 100.0]]
        b2.conf = [0.95]
        b2.cls = [0]

        mock_result = MagicMock()
        mock_result.boxes = [b1, b2]
        mock_result.names = {0: "bottle"}
        mock_model = MagicMock()
        mock_model.predict.return_value = [mock_result]
        mock_get_yolo.return_value = mock_model

        detections = [
            {"detection_id": 1, "product_id": "p001", "product": {"id": "p001", "name": "Milk", "price": 62, "weight": 1.0}, "decision": "MATCH"},
            {"detection_id": 2, "product_id": "p001", "product": {"id": "p001", "name": "Milk", "price": 62, "weight": 1.0}, "decision": "MATCH"}
        ]
        cart = aggregate_detected_products(detections)
        self.assertEqual(len(cart), 1)
        self.assertEqual(cart[0]["quantity"], 2)
        self.assertEqual(cart[0]["total_price"], 124)

    @patch("app.vision_service.get_yolo_model")
    def test_05_same_product_x5(self, mock_get_yolo):
        """Test Case 5: Same product x 5."""
        detections = [
            {"detection_id": i + 1, "product_id": "p001", "product": {"id": "p001", "name": "Milk", "price": 62, "weight": 1.0}, "decision": "MATCH"}
            for i in range(5)
        ]
        cart = aggregate_detected_products(detections)
        self.assertEqual(cart[0]["quantity"], 5)
        self.assertEqual(cart[0]["total_price"], 310)

    def test_06_three_products_plus_duplicate(self):
        """Test Case 6: Three products with duplicate (Milk x 2, Maggi x 1, Bread x 1)."""
        detections = [
            {"detection_id": 1, "product_id": "p001", "product": {"id": "p001", "name": "Milk", "price": 62, "weight": 1.0}, "decision": "MATCH"},
            {"detection_id": 2, "product_id": "p002", "product": {"id": "p002", "name": "Maggi", "price": 14, "weight": 0.07}, "decision": "MATCH"},
            {"detection_id": 3, "product_id": "p001", "product": {"id": "p001", "name": "Milk", "price": 62, "weight": 1.0}, "decision": "MATCH"},
            {"detection_id": 4, "product_id": "p003", "product": {"id": "p003", "name": "Bread", "price": 45, "weight": 0.4}, "decision": "MATCH"}
        ]
        cart = aggregate_detected_products(detections)
        self.assertEqual(len(cart), 3)
        milk = next(c for c in cart if c["product_id"] == "p001")
        self.assertEqual(milk["quantity"], 2)

    def test_07_unknown_object(self):
        """Test Case 7: Unknown object is not aggregated into verified cart."""
        detections = [
            {"detection_id": 1, "product_id": "p001", "product": {"id": "p001", "name": "Milk", "price": 62, "weight": 1.0}, "decision": "MATCH"},
            {"detection_id": 2, "product_id": None, "product": None, "decision": "UNKNOWN"}
        ]
        cart = aggregate_detected_products(detections)
        self.assertEqual(len(cart), 1)
        self.assertEqual(cart[0]["product_id"], "p001")

    def test_08_review_product(self):
        """Test Case 8: Review product is not automatically aggregated into verified cart."""
        detections = [
            {"detection_id": 1, "product_id": "p001", "product": {"id": "p001", "name": "Milk", "price": 62, "weight": 1.0}, "decision": "MATCH"},
            {"detection_id": 2, "product_id": "p002", "product": {"id": "p002", "name": "Gold Milk", "price": 65, "weight": 1.0}, "decision": "REVIEW"}
        ]
        cart = aggregate_detected_products(detections)
        self.assertEqual(len(cart), 1)
        self.assertEqual(cart[0]["product_id"], "p001")

    def test_09_barcode_plus_visual_match(self):
        """Test Case 9: Barcode + visual match agree -> MATCH."""
        barcodes = [{"value": "8901234567890", "product_id": "p001", "bbox": {"x1": 10, "y1": 10, "x2": 50, "y2": 50}}]
        detections = [{"detection_id": 1, "bbox": {"x1": 5, "y1": 5, "x2": 100, "y2": 100}}]
        assoc = associate_barcode_with_product(barcodes, detections)
        self.assertEqual(assoc[0]["associated_detection_id"], 1)

    def test_10_barcode_plus_visual_mismatch(self):
        """Test Case 10: Barcode product disagrees with visual product -> MISMATCH."""
        barcodes = [{"value": "8901234567890", "product_id": "p001", "bbox": {"x1": 10, "y1": 10, "x2": 50, "y2": 50}}]
        detections = [{"detection_id": 1, "bbox": {"x1": 5, "y1": 5, "x2": 100, "y2": 100}}]
        assoc = associate_barcode_with_product(barcodes, detections)
        self.assertEqual(assoc[0]["associated_product_id"], "p001")

    def test_11_multiple_barcodes(self):
        """Test Case 11: Multiple barcodes mapped to distinct bounding boxes."""
        barcodes = [
            {"value": "111", "product_id": "p001", "bbox": {"x1": 10, "y1": 10, "x2": 50, "y2": 50}},
            {"value": "222", "product_id": "p002", "bbox": {"x1": 200, "y1": 10, "x2": 250, "y2": 50}}
        ]
        detections = [
            {"detection_id": 1, "bbox": {"x1": 0, "y1": 0, "x2": 100, "y2": 100}},
            {"detection_id": 2, "bbox": {"x1": 180, "y1": 0, "x2": 280, "y2": 100}}
        ]
        assoc = associate_barcode_with_product(barcodes, detections)
        self.assertEqual(assoc[0]["associated_detection_id"], 1)
        self.assertEqual(assoc[1]["associated_detection_id"], 2)

    @patch("app.vision_service.get_yolo_model")
    def test_12_multiple_products_without_barcodes(self, mock_get_yolo):
        """Test Case 12: Multiple products recognized visually without barcodes."""
        b1, b2 = MagicMock(), MagicMock()
        b1.xyxy = [[10.0, 10.0, 100.0, 100.0]]
        b1.conf = [0.95]
        b1.cls = [0]
        b2.xyxy = [[150.0, 10.0, 250.0, 100.0]]
        b2.conf = [0.92]
        b2.cls = [1]

        mock_result = MagicMock()
        mock_result.boxes = [b1, b2]
        mock_result.names = {0: "bottle", 1: "cup"}
        mock_model = MagicMock()
        mock_model.predict.return_value = [mock_result]
        mock_get_yolo.return_value = mock_model

        res = detect_products_from_bytes(self.test_image_bytes)
        self.assertTrue(res["success"])

    @patch("app.vision_service.get_yolo_model")
    def test_13_overlapping_products(self, mock_get_yolo):
        """Test Case 13: Overlapping product bounding boxes processed independently."""
        b1, b2 = MagicMock(), MagicMock()
        b1.xyxy = [[50.0, 50.0, 200.0, 200.0]]
        b1.conf = [0.91]
        b1.cls = [0]
        b2.xyxy = [[100.0, 100.0, 250.0, 250.0]]
        b2.conf = [0.88]
        b2.cls = [1]

        mock_result = MagicMock()
        mock_result.boxes = [b1, b2]
        mock_result.names = {0: "bottle", 1: "cup"}
        mock_model = MagicMock()
        mock_model.predict.return_value = [mock_result]
        mock_get_yolo.return_value = mock_model

        res = detect_products_from_bytes(self.test_image_bytes)
        self.assertEqual(len(res["detections"]), 2)

    @patch("app.vision_service.get_yolo_model")
    def test_14_small_partial_product(self, mock_get_yolo):
        """Test Case 14: Small crop below MIN_CROP_WIDTH / MIN_CROP_HEIGHT marked as review."""
        b_tiny = MagicMock()
        b_tiny.xyxy = [[10.0, 10.0, 12.0, 12.0]] # 2x2 px bbox
        b_tiny.conf = [0.80]
        b_tiny.cls = [0]

        mock_result = MagicMock()
        mock_result.boxes = [b_tiny]
        mock_result.names = {0: "bottle"}
        mock_model = MagicMock()
        mock_model.predict.return_value = [mock_result]
        mock_get_yolo.return_value = mock_model

        crop_res = extract_crops_and_detections(np.zeros((100, 100, 3), dtype=np.uint8))
        det = crop_res["raw_detections"][0]
        self.assertTrue(det["is_too_small"])

    @patch("app.vision_service.find_salient_object_regions", return_value=[])
    @patch("app.visual_index_service.search_similar", return_value=[])
    @patch("app.vision_service.get_yolo_model")
    def test_15_empty_frame(self, mock_get_yolo, mock_search, mock_salient):
        """Test Case 15: Empty frame returning NO_PRODUCT status and 0 detections."""
        mock_result = MagicMock()
        mock_result.boxes = []
        mock_result.names = {}
        mock_model = MagicMock()
        mock_model.predict.return_value = [mock_result]
        mock_get_yolo.return_value = mock_model

        res = perform_multi_product_recognition(self.test_image_bytes)
        self.assertEqual(res["total_detections"], 0)
        self.assertEqual(res["frame_status"], "NO_PRODUCT")



    @patch("app.vision_service.get_yolo_model")
    def test_16_more_than_max_multi_detections(self, mock_get_yolo):
        """Test Case 16: More than MAX_MULTI_DETECTIONS truncated gracefully."""
        boxes = []
        for i in range(25):
            b = MagicMock()
            b.xyxy = [[i * 10.0, 10.0, i * 10.0 + 8.0, 50.0]]
            b.conf = [0.80 + (i % 10) * 0.01]
            b.cls = [0]
            boxes.append(b)

        mock_result = MagicMock()
        mock_result.boxes = boxes
        mock_result.names = {0: "bottle"}
        mock_model = MagicMock()
        mock_model.predict.return_value = [mock_result]
        mock_get_yolo.return_value = mock_model

        crop_res = extract_crops_and_detections(np.zeros((640, 480, 3), dtype=np.uint8), max_detections=20)
        self.assertTrue(crop_res["detections_truncated"])
        self.assertEqual(len(crop_res["raw_detections"]), 20)

    def test_17_exact_quantity_match(self):
        """Test Case 17: Exact quantity aggregation calculation."""
        detections = [
            {"detection_id": 1, "product_id": "p001", "product": {"id": "p001", "name": "Milk", "price": 62, "weight": 1.0}, "decision": "MATCH"},
            {"detection_id": 2, "product_id": "p001", "product": {"id": "p001", "name": "Milk", "price": 62, "weight": 1.0}, "decision": "MATCH"},
            {"detection_id": 3, "product_id": "p001", "product": {"id": "p001", "name": "Milk", "price": 62, "weight": 1.0}, "decision": "MATCH"}
        ]
        cart = aggregate_detected_products(detections)
        self.assertEqual(cart[0]["quantity"], 3)
        self.assertEqual(cart[0]["total_expected_weight"], 3.0)

    def test_18_missing_product(self):
        """Test Case 18: Missing product in predicted set."""
        expected = ["Milk", "Maggi", "Bread"]
        predicted = ["Milk", "Maggi"]

        exp_freq = {p: expected.count(p) for p in expected}
        pred_freq = {p: predicted.count(p) for p in predicted}
        self.assertNotEqual(exp_freq, pred_freq)

    def test_19_extra_product(self):
        """Test Case 19: Extra product in predicted set (false positive)."""
        expected = ["Milk", "Maggi"]
        predicted = ["Milk", "Maggi", "Bread"]

        exp_freq = {p: expected.count(p) for p in expected}
        pred_freq = {p: predicted.count(p) for p in predicted}
        self.assertNotEqual(exp_freq, pred_freq)

    def test_20_exact_cart_set_match(self):
        """Test Case 20: Exact cart-set match verification."""
        expected = ["Milk", "Milk", "Maggi"]
        predicted = ["Milk", "Milk", "Maggi"]

        exp_freq = {p: expected.count(p) for p in expected}
        pred_freq = {p: predicted.count(p) for p in predicted}
        self.assertEqual(exp_freq, pred_freq)

if __name__ == "__main__":
    unittest.main()
