import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db import get_db, Base
import app.models as _models
from app.verification_engine import VerificationEngine


from sqlalchemy.pool import StaticPool

# In-memory SQLite database setup for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True, scope="module")
def setup_teardown_db_override():
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()


client = TestClient(app)



# Sample Catalog & Cart Fixtures
PROD_BUTTER = {
    "product_id": "prod_amul_butter",
    "barcode": "8901262010052",
    "name": "Amul Pasteurised Butter 500g",
    "price": 275.0,
    "weight": 0.50,
    "category": "Dairy & Eggs",
}

PROD_SALT = {
    "product_id": "prod_tata_salt",
    "barcode": "8901058000078",
    "name": "Tata Salt Iodized 1kg",
    "price": 28.0,
    "weight": 1.00,
    "category": "Grocery Essentials",
}

CATALOG = {
    PROD_BUTTER["barcode"]: PROD_BUTTER,
    PROD_BUTTER["product_id"]: PROD_BUTTER,
    PROD_SALT["barcode"]: PROD_SALT,
    PROD_SALT["product_id"]: PROD_SALT,
}


@pytest.fixture
def verification_engine():
    return VerificationEngine(weight_tolerance_kg=0.05)


@pytest.fixture
def active_butter_session():
    return {
        "session_id": "sess_active_001",
        "status": "ACTIVE",
        "items": [
            {
                "product_id": PROD_BUTTER["product_id"],
                "barcode": PROD_BUTTER["barcode"],
                "name": PROD_BUTTER["name"],
                "price": PROD_BUTTER["price"],
                "weight": PROD_BUTTER["weight"],
                "quantity": 1,
            }
        ],
    }


# SCENARIO 1: Correct product
def test_scenario_01_correct_product(verification_engine, active_butter_session):
    res = verification_engine.verify(
        session_data=active_butter_session,
        actual_weight=0.50,
        detected_products=[{"name": PROD_BUTTER["name"], "barcode": PROD_BUTTER["barcode"], "confidence": 0.95}],
        barcode_results=[PROD_BUTTER["barcode"]],
        catalog_products=CATALOG,
    )

    assert res["status"] == "PASS"
    assert res["risk_score"] == 0.0
    assert res["checks"]["session"] is True
    assert res["checks"]["barcode"] is True
    assert res["checks"]["vision"] is True
    assert res["checks"]["product"] is True
    assert res["checks"]["quantity"] is True
    assert res["checks"]["amount"] is True
    assert res["checks"]["weight"] is True
    assert res["differences"]["weight"] == 0.0
    assert res["differences"]["amount"] == 0.0


# SCENARIO 2: Unknown product
def test_scenario_02_unknown_product(verification_engine, active_butter_session):
    unknown_barcode = "9999999999999"
    res = verification_engine.verify(
        session_data=active_butter_session,
        actual_weight=0.50,
        detected_products=[{"name": "Unknown Product", "barcode": unknown_barcode, "confidence": 0.90}],
        barcode_results=[unknown_barcode],
        catalog_products=CATALOG,
    )

    assert res["status"] in ["FAIL", "REVIEW"]
    assert res["checks"]["barcode"] is False
    assert res["checks"]["product"] is False
    assert any("not exist in catalog" in r for r in res["reasons"])


# SCENARIO 3: Wrong barcode
def test_scenario_03_wrong_barcode(verification_engine, active_butter_session):
    # Session has Butter, but user scans Salt barcode
    res = verification_engine.verify(
        session_data=active_butter_session,
        actual_weight=0.50,
        detected_products=[{"name": PROD_BUTTER["name"], "barcode": PROD_BUTTER["barcode"], "confidence": 0.95}],
        barcode_results=[PROD_SALT["barcode"]],
        catalog_products=CATALOG,
    )

    assert res["status"] in ["FAIL", "REVIEW"]
    assert res["checks"]["barcode"] is False
    assert any("do not match session cart" in r for r in res["reasons"])


# SCENARIO 4: Barcode/vision mismatch
def test_scenario_04_barcode_vision_mismatch(verification_engine, active_butter_session):
    # Scanned barcode is Butter, but Vision detects Salt
    res = verification_engine.verify(
        session_data=active_butter_session,
        actual_weight=0.50,
        detected_products=[{"name": PROD_SALT["name"], "barcode": PROD_SALT["barcode"], "confidence": 0.90}],
        barcode_results=[PROD_BUTTER["barcode"]],
        catalog_products=CATALOG,
    )

    assert res["status"] in ["REVIEW", "FAIL"]
    assert res["checks"]["barcode"] is True
    assert res["checks"]["vision"] is False
    assert any("Vision detected products do not match" in r for r in res["reasons"])


# SCENARIO 5: Low AI confidence
def test_scenario_05_low_ai_confidence(verification_engine, active_butter_session):
    res = verification_engine.verify(
        session_data=active_butter_session,
        actual_weight=0.50,
        detected_products=[{"name": PROD_BUTTER["name"], "barcode": PROD_BUTTER["barcode"], "confidence": 0.35}],
        barcode_results=[PROD_BUTTER["barcode"]],
        catalog_products=CATALOG,
    )

    assert res["status"] in ["REVIEW", "FAIL"]
    assert res["ai_analysis"] is not None
    assert res["ai_analysis"]["risk_score"] > 0.50
    assert res["ai_analysis"]["recommendation"] in ["REVIEW", "FAIL"]


# SCENARIO 6: Correct weight
def test_scenario_06_correct_weight(verification_engine, active_butter_session):
    res = verification_engine.verify(
        session_data=active_butter_session,
        actual_weight=0.50,
        detected_products=[PROD_BUTTER["barcode"]],
        barcode_results=[PROD_BUTTER["barcode"]],
        catalog_products=CATALOG,
    )

    assert res["status"] == "PASS"
    assert res["checks"]["weight"] is True
    assert res["differences"]["weight"] == 0.0


# SCENARIO 7: Small weight mismatch (within tolerance 0.05kg)
def test_scenario_07_small_weight_mismatch(verification_engine, active_butter_session):
    # Expected: 0.50kg, Actual: 0.53kg (diff 0.03kg <= 0.05kg tolerance)
    res = verification_engine.verify(
        session_data=active_butter_session,
        actual_weight=0.53,
        detected_products=[PROD_BUTTER["barcode"]],
        barcode_results=[PROD_BUTTER["barcode"]],
        catalog_products=CATALOG,
    )

    assert res["status"] == "REVIEW"
    assert res["checks"]["weight"] is True
    assert res["differences"]["weight"] == 0.03
    assert res["risk_score"] > 0.0


# SCENARIO 8: Large weight mismatch (exceeds 0.05kg tolerance)
def test_scenario_08_large_weight_mismatch(verification_engine, active_butter_session):
    # Expected: 0.50kg, Actual: 0.85kg (diff 0.35kg > 0.05kg tolerance)
    res = verification_engine.verify(
        session_data=active_butter_session,
        actual_weight=0.85,
        detected_products=[PROD_BUTTER["barcode"]],
        barcode_results=[PROD_BUTTER["barcode"]],
        catalog_products=CATALOG,
    )

    assert res["status"] == "FAIL"
    assert res["checks"]["weight"] is False
    assert res["differences"]["weight"] == 0.35
    assert any("exceeds tolerance" in r for r in res["reasons"])


# SCENARIO 9: Wrong quantity
def test_scenario_09_wrong_quantity(verification_engine, active_butter_session):
    # Cart expected 1 item, but scanned 2 items
    res = verification_engine.verify(
        session_data=active_butter_session,
        actual_weight=1.00,
        detected_products=[PROD_BUTTER["barcode"], PROD_BUTTER["barcode"]],
        barcode_results=[PROD_BUTTER["barcode"], PROD_BUTTER["barcode"]],
        catalog_products=CATALOG,
    )

    assert res["status"] in ["FAIL", "REVIEW"]
    assert res["checks"]["quantity"] is False
    assert any("Quantity mismatch" in r for r in res["reasons"])


# SCENARIO 10: Wrong amount
def test_scenario_10_wrong_amount(verification_engine, active_butter_session):
    # Scanned barcode for Salt (₹28) when expected cart has Butter (₹275)
    res = verification_engine.verify(
        session_data=active_butter_session,
        actual_weight=1.00,
        detected_products=[PROD_SALT["barcode"]],
        barcode_results=[PROD_SALT["barcode"]],
        catalog_products=CATALOG,
    )

    assert res["status"] in ["FAIL", "REVIEW"]
    assert res["checks"]["amount"] is False
    assert any("amount mismatch" in r.lower() for r in res["reasons"])


# SCENARIO 11: Empty cart
def test_scenario_11_empty_cart(verification_engine):
    empty_session = {
        "session_id": "sess_empty_001",
        "status": "ACTIVE",
        "items": [],
    }

    res = verification_engine.verify(
        session_data=empty_session,
        actual_weight=0.0,
        detected_products=[],
        barcode_results=[],
        catalog_products=CATALOG,
    )

    assert res["status"] in ["FAIL", "REVIEW"]
    assert res["checks"]["product"] is False


# SCENARIO 12: Invalid session
def test_scenario_12_invalid_session(verification_engine):
    invalid_session = {
        "session_id": "sess_closed_001",
        "status": "CLOSED",
        "items": [],
    }

    res = verification_engine.verify(
        session_data=invalid_session,
        actual_weight=0.50,
        detected_products=[PROD_BUTTER["barcode"]],
        barcode_results=[PROD_BUTTER["barcode"]],
        catalog_products=CATALOG,
    )

    assert res["status"] == "FAIL"
    assert res["checks"]["session"] is False
    assert any("Invalid or inactive" in r for r in res["reasons"])


# SCENARIO 13: Unauthorized request (None session)
def test_scenario_13_unauthorized_request(verification_engine):
    res = verification_engine.verify(
        session_data=None,
        actual_weight=0.50,
        detected_products=[PROD_BUTTER["barcode"]],
        barcode_results=[PROD_BUTTER["barcode"]],
        catalog_products=CATALOG,
    )

    assert res["status"] == "FAIL"
    assert res["checks"]["session"] is False


# SCENARIO 14: Multiple products
def test_scenario_14_multiple_products(verification_engine):
    multi_session = {
        "session_id": "sess_multi_001",
        "status": "ACTIVE",
        "items": [
            {
                "product_id": PROD_BUTTER["product_id"],
                "barcode": PROD_BUTTER["barcode"],
                "name": PROD_BUTTER["name"],
                "price": PROD_BUTTER["price"],
                "weight": PROD_BUTTER["weight"],
                "quantity": 1,
            },
            {
                "product_id": PROD_SALT["product_id"],
                "barcode": PROD_SALT["barcode"],
                "name": PROD_SALT["name"],
                "price": PROD_SALT["price"],
                "weight": PROD_SALT["weight"],
                "quantity": 1,
            },
        ],
    }

    # Total expected weight: 0.50 + 1.00 = 1.50kg
    res = verification_engine.verify(
        session_data=multi_session,
        actual_weight=1.50,
        detected_products=[
            {"name": PROD_BUTTER["name"], "barcode": PROD_BUTTER["barcode"], "confidence": 0.95},
            {"name": PROD_SALT["name"], "barcode": PROD_SALT["barcode"], "confidence": 0.92},
        ],
        barcode_results=[PROD_BUTTER["barcode"], PROD_SALT["barcode"]],
        catalog_products=CATALOG,
    )

    assert res["status"] == "PASS"
    assert res["risk_score"] == 0.0
    assert all(res["checks"].values())


# SCENARIO 15: Mixed correct and incorrect products
def test_scenario_15_mixed_correct_incorrect(verification_engine):
    multi_session = {
        "session_id": "sess_multi_002",
        "status": "ACTIVE",
        "items": [
            {
                "product_id": PROD_BUTTER["product_id"],
                "barcode": PROD_BUTTER["barcode"],
                "name": PROD_BUTTER["name"],
                "price": PROD_BUTTER["price"],
                "weight": PROD_BUTTER["weight"],
                "quantity": 1,
            },
            {
                "product_id": PROD_SALT["product_id"],
                "barcode": PROD_SALT["barcode"],
                "name": PROD_SALT["name"],
                "price": PROD_SALT["price"],
                "weight": PROD_SALT["weight"],
                "quantity": 1,
            },
        ],
    }

    # User scanned Butter correctly, but scanned unknown barcode for second product
    res = verification_engine.verify(
        session_data=multi_session,
        actual_weight=1.50,
        detected_products=[
            {"name": PROD_BUTTER["name"], "barcode": PROD_BUTTER["barcode"], "confidence": 0.95},
        ],
        barcode_results=[PROD_BUTTER["barcode"], "9999999999999"],
        catalog_products=CATALOG,
    )

    assert res["status"] in ["FAIL", "REVIEW"]
    assert res["checks"]["barcode"] is False
