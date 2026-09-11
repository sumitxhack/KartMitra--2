import unittest
import numpy as np
from app.multi_signal_engine import fuse_multi_signals


class TestMultiSignalScenarios17(unittest.TestCase):
    """
    Automated evaluation test suite for all 17 multi-signal verification scenarios.
    """

    def setUp(self):
        self.prod1 = {"id": "p001", "name": "Amul Taaza Milk", "barcode": "8901234567890"}
        self.prod2 = {"id": "p002", "name": "Amul Gold Milk", "barcode": "8901234567891"}
        self.prod3 = {"id": "p003", "name": "Maggi Noodles", "barcode": "8901234567892"}
        self.prod4 = {"id": "p004", "name": "Britannia Whole Wheat Bread", "barcode": "8901234567893"}

    # 1. Barcode only
    def test_scenario_01_barcode_only(self):
        bc = {"detected": True, "barcode": "8901234567890", "product_id": "p001", "product_name": "Amul Taaza Milk", "score": 1.0}
        res = fuse_multi_signals(bc, {"detected": False}, {"detected": False}, {"detected": False})
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p001")

    # 2. OCR only
    def test_scenario_02_ocr_only(self):
        ocr = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "extracted_text": "AMUL TAAZA HOMOGENISED TONED MILK", "score": 0.88}
        res = fuse_multi_signals({"detected": False}, {"detected": False}, ocr, {"detected": False})
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p001")

    # 3. Vision only
    def test_scenario_03_vision_only(self):
        vis = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "confidence": 0.90, "score": 0.90}
        sim = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "similarity": 0.88, "score": 0.88}
        res = fuse_multi_signals({"detected": False}, vis, {"detected": False}, sim)
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p001")

    # 4. Barcode + OCR
    def test_scenario_04_barcode_plus_ocr(self):
        bc = {"detected": True, "barcode": "8901234567890", "product_id": "p001", "product_name": "Amul Taaza Milk", "score": 1.0}
        ocr = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "extracted_text": "AMUL TAAZA MILK", "score": 0.92}
        res = fuse_multi_signals(bc, {"detected": False}, ocr, {"detected": False})
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p001")

    # 5. Barcode + Vision
    def test_scenario_05_barcode_plus_vision(self):
        bc = {"detected": True, "barcode": "8901234567890", "product_id": "p001", "product_name": "Amul Taaza Milk", "score": 1.0}
        vis = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "confidence": 0.94, "score": 0.94}
        res = fuse_multi_signals(bc, vis, {"detected": False}, {"detected": False})
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p001")

    # 6. Vision + OCR
    def test_scenario_06_vision_plus_ocr(self):
        vis = {"detected": True, "product_id": "p003", "product_name": "Maggi Noodles", "confidence": 0.88, "score": 0.88}
        ocr = {"detected": True, "product_id": "p003", "product_name": "Maggi Noodles", "extracted_text": "MAGGI 2 MINUTE NOODLES", "score": 0.90}
        res = fuse_multi_signals({"detected": False}, vis, ocr, {"detected": False})
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p003")

    # 7. Barcode + Vision + OCR
    def test_scenario_07_all_signals_full_agreement(self):
        bc = {"detected": True, "barcode": "8901234567890", "product_id": "p001", "product_name": "Amul Taaza Milk", "score": 1.0}
        vis = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "confidence": 0.95, "score": 0.95}
        ocr = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "extracted_text": "AMUL TAAZA TONED MILK", "score": 0.95}
        sim = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "similarity": 0.94, "score": 0.94}
        res = fuse_multi_signals(bc, vis, ocr, sim)
        self.assertEqual(res["status"], "MATCH")
        self.assertGreaterEqual(res["confidence"], 0.95)

    # 8. Correct product verification
    def test_scenario_08_correct_product(self):
        bc = {"detected": True, "barcode": "8901234567893", "product_id": "p004", "product_name": "Britannia Whole Wheat Bread", "score": 1.0}
        ocr = {"detected": True, "product_id": "p004", "product_name": "Britannia Whole Wheat Bread", "extracted_text": "BRITANNIA 100% WHOLE WHEAT", "score": 0.93}
        res = fuse_multi_signals(bc, {"detected": False}, ocr, {"detected": False})
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p004")

    # 9. Wrong product / Mismatch
    def test_scenario_09_wrong_product_mismatch(self):
        bc = {"detected": True, "barcode": "8901234567890", "product_id": "p001", "product_name": "Amul Taaza Milk", "score": 1.0}
        vis = {"detected": True, "product_id": "p003", "product_name": "Maggi Noodles", "confidence": 0.93, "score": 0.93}
        ocr = {"detected": True, "product_id": "p003", "product_name": "Maggi Noodles", "extracted_text": "MAGGI NOODLES", "score": 0.95}
        res = fuse_multi_signals(bc, vis, ocr, {"detected": False})
        self.assertEqual(res["status"], "MISMATCH")
        self.assertEqual(res["recommended_action"], "REJECT")

    # 10. Similar product conflict (Amul Taaza vs Amul Gold)
    def test_scenario_10_similar_product_conflict(self):
        bc = {"detected": True, "barcode": "8901234567890", "product_id": "p001", "product_name": "Amul Taaza Milk", "score": 1.0}
        ocr = {"detected": True, "product_id": "p002", "product_name": "Amul Gold Milk", "extracted_text": "AMUL GOLD FULL CREAM MILK", "score": 0.92}
        res = fuse_multi_signals(bc, {"detected": False}, ocr, {"detected": False})
        self.assertEqual(res["status"], "MISMATCH")

    # 11. Multiple products independently processed
    def test_scenario_11_multiple_products(self):
        # Crop 1: Milk
        res1 = fuse_multi_signals({"detected": True, "barcode": "8901234567890", "product_id": "p001", "product_name": "Amul Taaza Milk", "score": 1.0}, {"detected": False}, {"detected": False}, {"detected": False})
        # Crop 2: Maggi
        res2 = fuse_multi_signals({"detected": True, "barcode": "8901234567892", "product_id": "p003", "product_name": "Maggi Noodles", "score": 1.0}, {"detected": False}, {"detected": False}, {"detected": False})
        # Crop 3: Bread
        res3 = fuse_multi_signals({"detected": True, "barcode": "8901234567893", "product_id": "p004", "product_name": "Britannia Bread", "score": 1.0}, {"detected": False}, {"detected": False}, {"detected": False})
        
        self.assertEqual(res1["status"], "MATCH")
        self.assertEqual(res2["status"], "MATCH")
        self.assertEqual(res3["status"], "MATCH")
        self.assertEqual(res1["product_id"], "p001")
        self.assertEqual(res2["product_id"], "p003")
        self.assertEqual(res3["product_id"], "p004")

    # 12. Product partially hidden / weak crop
    def test_scenario_12_partially_hidden_crop(self):
        vis = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "confidence": 0.45, "score": 0.45}
        ocr = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "extracted_text": "MILK", "score": 0.48}
        res = fuse_multi_signals({"detected": False}, vis, ocr, {"detected": False})
        self.assertEqual(res["status"], "REVIEW")
        self.assertEqual(res["recommended_action"], "MANUAL_REVIEW")

    # 13. Poor lighting / noisy crop
    def test_scenario_13_noisy_crop_ocr_typos(self):
        ocr = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "extracted_text": "AMUL TAAZA M1LK PURE M!LK", "score": 0.82}
        vis = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "confidence": 0.80, "score": 0.80}
        res = fuse_multi_signals({"detected": False}, vis, ocr, {"detected": False})
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p001")

    # 14. Product rotated / angled
    def test_scenario_14_product_rotated(self):
        sim = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "similarity": 0.85, "score": 0.85}
        ocr = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "extracted_text": "AMUL TAAZA", "score": 0.80}
        res = fuse_multi_signals({"detected": False}, {"detected": False}, ocr, sim)
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p001")

    # 15. Product on different backgrounds
    def test_scenario_15_different_background(self):
        bc = {"detected": True, "barcode": "8901234567892", "product_id": "p003", "product_name": "Maggi Noodles", "score": 1.0}
        sim = {"detected": True, "product_id": "p003", "product_name": "Maggi Noodles", "similarity": 0.89, "score": 0.89}
        res = fuse_multi_signals(bc, {"detected": False}, {"detected": False}, sim)
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p003")

    # 16. Empty cart / background rejection
    def test_scenario_16_empty_cart_rejection(self):
        res = fuse_multi_signals({"detected": False}, {"detected": False}, {"detected": False}, {"detected": False})
        self.assertEqual(res["status"], "UNKNOWN")
        self.assertIsNone(res["product_id"])

    # 17. Unknown product
    def test_scenario_17_unknown_unregistered_product(self):
        bc = {"detected": True, "barcode": "9999999999999", "product_id": None, "score": 0.0}
        res = fuse_multi_signals(bc, {"detected": False}, {"detected": False}, {"detected": False})
        self.assertEqual(res["status"], "UNKNOWN")
        self.assertIsNone(res["product_id"])


if __name__ == "__main__":
    unittest.main()
