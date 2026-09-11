import unittest
import numpy as np
import cv2
from app.ocr_service import (
    normalize_text,
    extract_keywords_from_text,
    compute_product_text_similarity,
    match_ocr_text_against_database,
    preprocess_image_for_ocr,
    run_ocr
)


class TestOCRService(unittest.TestCase):

    def test_text_normalization_lowercase_uppercase_whitespace(self):
        raw = "   AMUL  taaza   MILK   1  LITRE!!  "
        normalized = normalize_text(raw)
        self.assertEqual(normalized, "AMUL TAAZA MILK 1 LITRE")

    def test_text_normalization_ocr_typos_correction(self):
        # M1LK -> MILK, MAGG1 -> MAGGI, BR3AD -> BREAD
        text_with_typos = "AMUL TAAZA M1LK PURE M!LK 1L"
        normalized = normalize_text(text_with_typos)
        self.assertIn("MILK", normalized)
        self.assertIn("1 LITRE", normalized)
        self.assertNotIn("M1LK", normalized)

    def test_extract_keywords(self):
        text = "Amul Taaza Milk Pure Fresh Homogenised Toned Milk Net Qty 1 Litre MFG Batch 2026"
        keywords = extract_keywords_from_text(text)
        self.assertIn("amul", keywords)
        self.assertIn("taaza", keywords)
        self.assertIn("milk", keywords)
        self.assertNotIn("qty", keywords)
        self.assertNotIn("mfg", keywords)
        self.assertNotIn("batch", keywords)

    def test_product_text_similarity_exact_and_fuzzy(self):
        prod = {
            "id": "p001",
            "name": "Amul Taaza Milk",
            "category": "Dairy",
            "keywords": ["amul", "taaza", "milk", "toned milk", "pure milk"],
            "ocr_text": "AMUL TAAZA HOMOGENISED TONED MILK"
        }

        # Test exact packaging text
        score1, kws1, reason1 = compute_product_text_similarity("AMUL TAAZA MILK 1 LITRE", prod)
        self.assertGreaterEqual(score1, 0.75)
        self.assertIn("amul", [k.lower() for k in kws1])
        self.assertIn("milk", [k.lower() for k in kws1])

        # Test noisy OCR with typo
        score2, kws2, reason2 = compute_product_text_similarity("AMUL TAAZA M1LK PURE M!LK", prod)
        self.assertGreaterEqual(score2, 0.70)

        # Test unrelated product text
        score3, kws3, reason3 = compute_product_text_similarity("BRITANNIA 100% WHOLE WHEAT BREAD", prod)
        self.assertLess(score3, 0.30)

    def test_match_against_product_database(self):
        products = [
            {
                "id": "p001",
                "name": "Amul Taaza Milk",
                "barcode": "8901234567890",
                "category": "Dairy",
                "keywords": ["amul", "taaza", "milk"]
            },
            {
                "id": "p002",
                "name": "Amul Gold Milk",
                "barcode": "8901234567891",
                "category": "Dairy",
                "keywords": ["amul", "gold", "milk", "full cream"]
            },
            {
                "id": "p003",
                "name": "Maggi 2-Minute Masala Noodles",
                "barcode": "8901234567892",
                "category": "Noodles",
                "keywords": ["maggi", "noodles", "masala", "2-minute"]
            }
        ]

        # Query 1: Taaza Milk
        match1 = match_ocr_text_against_database("AMUL TAAZA FRESH TONED MILK 1L", products)
        self.assertTrue(match1["matched"])
        self.assertEqual(match1["best_match"]["product_id"], "p001")

        # Query 2: Gold Milk (Distinguishing similar products)
        match2 = match_ocr_text_against_database("AMUL GOLD FULL CREAM MILK", products)
        self.assertTrue(match2["matched"])
        self.assertEqual(match2["best_match"]["product_id"], "p002")

        # Query 3: Maggi
        match3 = match_ocr_text_against_database("MAGGI 2 MINUTE NOODLES TASTEMAKER", products)
        self.assertTrue(match3["matched"])
        self.assertEqual(match3["best_match"]["product_id"], "p003")

    def test_image_preprocessing_and_ocr_run(self):
        # Create a synthetic image with printed text
        img = np.full((120, 400, 3), 255, dtype=np.uint8)
        cv2.putText(img, "AMUL TAAZA MILK", (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 2)

        preprocessed = preprocess_image_for_ocr(img)
        self.assertIsNotNone(preprocessed)
        self.assertEqual(preprocessed.shape[2], 3)

        res = run_ocr(img)
        self.assertIn("raw_text", res)
        self.assertIn("normalized_text", res)
        # Even on simple synthetic test, normalized_text should be extracted
        if res["raw_text"]:
            self.assertIn("AMUL", res["normalized_text"])


if __name__ == "__main__":
    unittest.main()
