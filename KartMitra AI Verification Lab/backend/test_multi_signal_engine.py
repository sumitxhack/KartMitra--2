import unittest
from app.multi_signal_engine import (
    fuse_multi_signals,
    DetectionStabilityTracker,
    get_decision_config,
    update_decision_config
)


class TestMultiSignalDecisionEngine(unittest.TestCase):

    def setUp(self):
        self.prod_milk = {"id": "p001", "name": "Amul Taaza Milk", "barcode": "8901234567890", "price": 62.0, "weight": 1.0}
        self.prod_gold = {"id": "p002", "name": "Amul Gold Milk", "barcode": "8901234567891", "price": 72.0, "weight": 1.0}
        self.prod_maggi = {"id": "p003", "name": "Maggi Noodles", "barcode": "8901234567892", "price": 14.0, "weight": 0.07}

    def test_01_barcode_only_identification(self):
        bc_sig = {"detected": True, "barcode": "8901234567890", "product_id": "p001", "product_name": "Amul Taaza Milk", "score": 1.0}
        vis_sig = {"detected": False}
        ocr_sig = {"detected": False}
        sim_sig = {"detected": False}

        res = fuse_multi_signals(bc_sig, vis_sig, ocr_sig, sim_sig)
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p001")
        self.assertEqual(res["recommended_action"], "ADD_TO_CART")
        self.assertGreaterEqual(res["confidence"], 0.90)

    def test_02_all_signals_agree_high_confidence(self):
        bc_sig = {"detected": True, "barcode": "8901234567890", "product_id": "p001", "product_name": "Amul Taaza Milk", "score": 1.0}
        vis_sig = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "confidence": 0.94, "score": 0.94}
        ocr_sig = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "extracted_text": "AMUL TAAZA MILK 1L", "score": 0.96}
        sim_sig = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "similarity": 0.93, "score": 0.93}

        res = fuse_multi_signals(bc_sig, vis_sig, ocr_sig, sim_sig)
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p001")
        self.assertGreaterEqual(res["confidence"], 0.95)
        self.assertEqual(res["recommended_action"], "ADD_TO_CART")

    def test_03_mismatch_barcode_vs_vision_and_ocr(self):
        # Barcode is Amul Taaza Milk, but Vision & OCR identify Amul Gold Milk
        bc_sig = {"detected": True, "barcode": "8901234567890", "product_id": "p001", "product_name": "Amul Taaza Milk", "score": 1.0}
        vis_sig = {"detected": True, "product_id": "p002", "product_name": "Amul Gold Milk", "confidence": 0.92, "score": 0.92}
        ocr_sig = {"detected": True, "product_id": "p002", "product_name": "Amul Gold Milk", "extracted_text": "AMUL GOLD FULL CREAM MILK", "score": 0.95}
        sim_sig = {"detected": True, "product_id": "p002", "product_name": "Amul Gold Milk", "similarity": 0.91, "score": 0.91}

        res = fuse_multi_signals(bc_sig, vis_sig, ocr_sig, sim_sig)
        self.assertEqual(res["status"], "MISMATCH")
        self.assertEqual(res["recommended_action"], "REJECT")
        self.assertIn("Barcode identifies", res["reason"])

    def test_04_ocr_only_identification_no_barcode(self):
        # Barcode not visible, but packaging OCR is strong
        bc_sig = {"detected": False}
        vis_sig = {"detected": False}
        ocr_sig = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "extracted_text": "AMUL TAAZA HOMOGENISED TONED MILK", "score": 0.88}
        sim_sig = {"detected": False}

        res = fuse_multi_signals(bc_sig, vis_sig, ocr_sig, sim_sig)
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p001")
        self.assertEqual(res["recommended_action"], "ADD_TO_CART")

    def test_05_vision_and_ocr_agree_without_barcode(self):
        # Barcode not visible, but YOLO + OCR + DINOv2 agree
        bc_sig = {"detected": False}
        vis_sig = {"detected": True, "product_id": "p003", "product_name": "Maggi Noodles", "confidence": 0.85, "score": 0.85}
        ocr_sig = {"detected": True, "product_id": "p003", "product_name": "Maggi Noodles", "extracted_text": "MAGGI 2 MINUTE NOODLES", "score": 0.89}
        sim_sig = {"detected": True, "product_id": "p003", "product_name": "Maggi Noodles", "similarity": 0.82, "score": 0.82}

        res = fuse_multi_signals(bc_sig, vis_sig, ocr_sig, sim_sig)
        self.assertEqual(res["status"], "MATCH")
        self.assertEqual(res["product_id"], "p003")
        self.assertEqual(res["recommended_action"], "ADD_TO_CART")

    def test_06_review_ambiguous_signal(self):
        # Weak OCR score and moderate similarity
        bc_sig = {"detected": False}
        vis_sig = {"detected": False}
        ocr_sig = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "extracted_text": "MILK", "score": 0.48}
        sim_sig = {"detected": True, "product_id": "p001", "product_name": "Amul Taaza Milk", "similarity": 0.58, "score": 0.58}

        res = fuse_multi_signals(bc_sig, vis_sig, ocr_sig, sim_sig)
        self.assertEqual(res["status"], "REVIEW")
        self.assertEqual(res["recommended_action"], "MANUAL_REVIEW")

    def test_07_unknown_background_rejection(self):
        # Empty frame / random background
        bc_sig = {"detected": False}
        vis_sig = {"detected": False}
        ocr_sig = {"detected": False}
        sim_sig = {"detected": False}

        res = fuse_multi_signals(bc_sig, vis_sig, ocr_sig, sim_sig)
        self.assertEqual(res["status"], "UNKNOWN")
        self.assertEqual(res["recommended_action"], "SCAN_AGAIN")
        self.assertIsNone(res["product_id"])

    def test_08_detection_stability_tracker_prevents_duplicate_adds(self):
        tracker = DetectionStabilityTracker(required_frames=3, cooldown_seconds=2.0)

        # Frame 1: not ready
        add1, reason1 = tracker.record_detection("p001")
        self.assertFalse(add1)

        # Frame 2: not ready
        add2, reason2 = tracker.record_detection("p001")
        self.assertFalse(add2)

        # Frame 3: stable -> trigger cart addition
        add3, reason3 = tracker.record_detection("p001")
        self.assertTrue(add3)

        # Frame 4 (immediately after): blocked by cooldown
        add4, reason4 = tracker.record_detection("p001")
        self.assertFalse(add4)
        self.assertIn("cooldown", reason4)


if __name__ == "__main__":
    unittest.main()
