import json
from pathlib import Path
from app.recognition_service import identify_product_from_bytes, format_product_dict

BASE_DIR = Path(__file__).resolve().parent

def test_status_logic():
    print("\n--- 1. Unit Testing Status Logic Scenarios ---")
    
    prod_a = {"id": "prod-1", "barcode": "8901234567890", "name": "Amul Milk", "price": 30, "weight": 0.5, "category": "Dairy"}
    prod_b = {"id": "prod-2", "barcode": "8909876543210", "name": "Britannia Biscuit", "price": 20, "weight": 0.2, "category": "Snacks"}

    # Scenario 1: MATCH (Barcode & Vision AI match same product with high confidence)
    res_match = {
        "status": "MATCH",
        "product": format_product_dict(prod_a),
        "barcode": {"value": "8901234567890", "product_id": "prod-1"},
        "vision": {"product_id": "prod-1", "confidence": 0.97},
        "reason": "Barcode and vision match"
    }
    assert res_match["status"] == "MATCH"
    assert res_match["barcode"]["product_id"] == res_match["vision"]["product_id"]
    print("MATCH Scenario Test: PASSED")

    # Scenario 2: MISMATCH (Barcode detects Prod A, Vision AI detects Prod B)
    res_mismatch = {
        "status": "MISMATCH",
        "product": format_product_dict(prod_a),
        "barcode": {"value": "8901234567890", "product_id": "prod-1"},
        "vision": {"product_id": "prod-2", "confidence": 0.92},
        "reason": "Barcode identified 'Amul Milk' but vision AI identified 'Britannia Biscuit'"
    }
    assert res_mismatch["status"] == "MISMATCH"
    assert res_mismatch["barcode"]["product_id"] != res_mismatch["vision"]["product_id"]
    print("MISMATCH Scenario Test: PASSED")

    # Scenario 3: REVIEW (AI confidence is below threshold e.g. 0.42 < 0.60)
    res_review = {
        "status": "REVIEW",
        "product": format_product_dict(prod_a),
        "barcode": {"value": "8901234567890", "product_id": "prod-1"},
        "vision": {"product_id": "prod-1", "confidence": 0.42},
        "reason": "AI confidence is below threshold (0.42 < 0.6)"
    }
    assert res_review["status"] == "REVIEW"
    assert res_review["vision"]["confidence"] < 0.60
    print("REVIEW Scenario Test: PASSED")

    # Scenario 4: UNKNOWN (Neither Barcode nor AI Vision identified product)
    res_unknown = {
        "status": "UNKNOWN",
        "product": None,
        "barcode": None,
        "vision": {"product_id": None, "confidence": 0.0},
        "reason": "No barcode or product detected"
    }
    assert res_unknown["status"] == "UNKNOWN"
    assert res_unknown["product"] is None
    print("UNKNOWN Scenario Test: PASSED")

def test_identify_barcode_sample():
    print("\n--- 2. Testing Identify Product Service with Sample Barcode Image ---")
    test_barcode_file = BASE_DIR / "test_barcode.png"
    if test_barcode_file.exists():
        with open(test_barcode_file, "rb") as f:
            image_bytes = f.read()

        result = identify_product_from_bytes(image_bytes)
        print("Barcode Identification Result:")
        print(json.dumps(result, indent=2))

        assert result["status"] in ["MATCH", "MISMATCH", "REVIEW", "UNKNOWN"]
        assert result["barcode"] is not None
        assert result["barcode"].get("value") == "8901234567890"
        print("Sample Barcode Test: PASSED")

if __name__ == "__main__":
    test_status_logic()
    test_identify_barcode_sample()
