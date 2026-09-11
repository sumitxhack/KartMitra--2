import os
import json
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.db import Base
from app import models, schemas, crud
from app.verification_engine import VerificationEngine
from app.main import app


def test_verification_engine_prompt_example():
    """
    Test exact prompt scenario:
    Session cart has 1 x Amul Taaza Milk (weight=1.0 kg, price=62).
    Actual weight measured is 1.03 kg.
    Tolerance is 0.05 kg.
    Expect status REVIEW, risk_score 0.35, checks all true, weight diff 0.03.
    """
    print("\n--- 1. Testing VerificationEngine Prompt Example ---")
    engine = VerificationEngine(weight_tolerance_kg=0.05)

    catalog = {
        "8901234567890": {
            "id": "prod_1",
            "barcode": "8901234567890",
            "name": "Amul Taaza Milk",
            "price": 62.0,
            "weight": 1.0,
            "category": "Dairy"
        }
    }

    session_data = {
        "id": "sess_prompt_001",
        "status": "ACTIVE",
        "items": [
            {
                "product_id": "prod_1",
                "barcode": "8901234567890",
                "name": "Amul Taaza Milk",
                "price": 62.0,
                "weight": 1.0,
                "quantity": 1
            }
        ]
    }

    res = engine.verify(
        session_data=session_data,
        actual_weight=1.03,
        detected_products=[],
        barcode_results=[],
        catalog_products=catalog
    )

    print("Engine Output for Prompt Example:")
    print(json.dumps(res, indent=2))

    assert res["status"] == "REVIEW"
    assert res["risk_score"] == 0.35
    assert res["checks"] == {
        "session": True,
        "barcode": True,
        "vision": True,
        "product": True,
        "quantity": True,
        "amount": True,
        "weight": True
    }
    assert res["expected"] == {"weight": 1.0, "amount": 62}
    assert res["actual"] == {"weight": 1.03, "amount": 62}
    assert res["differences"] == {"weight": 0.03, "amount": 0}
    assert res["reasons"] == []

    print("Prompt Example Test: PASSED")


def test_verification_engine_pass_status():
    """
    Test exact match scenario:
    Expected weight: 1.0 kg, Actual weight: 1.0 kg, Amount: 62.
    Expect status PASS, risk_score 0.0.
    """
    print("\n--- 2. Testing VerificationEngine PASS Status ---")
    engine = VerificationEngine(weight_tolerance_kg=0.05)

    catalog = {
        "8901234567890": {
            "id": "prod_1",
            "barcode": "8901234567890",
            "name": "Amul Taaza Milk",
            "price": 62.0,
            "weight": 1.0
        }
    }

    session_data = {
        "id": "sess_pass_001",
        "status": "ACTIVE",
        "items": [
            {
                "product_id": "prod_1",
                "barcode": "8901234567890",
                "price": 62.0,
                "weight": 1.0,
                "quantity": 1
            }
        ]
    }

    res = engine.verify(
        session_data=session_data,
        actual_weight=1.0,
        detected_products=["8901234567890"],
        barcode_results=["8901234567890"],
        catalog_products=catalog
    )

    assert res["status"] == "PASS"
    assert res["risk_score"] == 0.0
    assert res["checks"]["weight"] is True
    assert res["differences"]["weight"] == 0.0
    assert res["differences"]["amount"] == 0

    print("PASS Status Test: PASSED")


def test_verification_engine_fail_scenarios():
    """
    Test failure scenarios:
    - Weight mismatch outside tolerance (e.g. 1.30 kg vs 1.0 kg)
    - Invalid session ID
    """
    print("\n--- 3. Testing VerificationEngine FAIL Scenarios ---")
    engine = VerificationEngine(weight_tolerance_kg=0.05)

    catalog = {
        "8901234567890": {
            "id": "prod_1",
            "barcode": "8901234567890",
            "price": 62.0,
            "weight": 1.0
        }
    }

    session_data = {
        "id": "sess_fail_001",
        "status": "ACTIVE",
        "items": [
            {
                "product_id": "prod_1",
                "barcode": "8901234567890",
                "price": 62.0,
                "weight": 1.0,
                "quantity": 1
            }
        ]
    }

    # 1. Weight exceeds tolerance (1.30 kg vs 1.0 kg -> diff 0.30 kg > 0.05)
    res_weight_fail = engine.verify(
        session_data=session_data,
        actual_weight=1.30,
        detected_products=[],
        barcode_results=[],
        catalog_products=catalog
    )
    assert res_weight_fail["status"] == "FAIL"
    assert res_weight_fail["checks"]["weight"] is False
    assert len(res_weight_fail["reasons"]) > 0

    # 2. Invalid session (None session)
    res_session_fail = engine.verify(
        session_data=None,
        actual_weight=1.0,
        detected_products=[],
        barcode_results=[],
        catalog_products=catalog
    )
    assert res_session_fail["status"] == "FAIL"
    assert res_session_fail["checks"]["session"] is False

    print("FAIL Scenarios Test: PASSED")


def test_verification_api_and_db_logging():
    """
    Test full API integration with in-memory SQLite DB:
    - Seed product
    - Create session
    - Call POST /api/v1/verification/verify
    - Verify response structure & DB logging
    """
    print("\n--- 4. Testing API Endpoint & DB Verification Logging ---")

    from sqlalchemy.pool import StaticPool
    SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
    test_engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    from app.db import get_db
    app.dependency_overrides[get_db] = override_get_db


    client = TestClient(app)

    db = TestingSessionLocal()

    # 1. Seed a test product
    product = crud.create_product(
        db,
        schemas.ProductCreate(
            barcode="8901234567890",
            name="Amul Taaza Milk",
            price=62.0,
            weight=1.0,
            category="Dairy"
        )
    )

    # 2. Create a test shopping session with 1 x Amul Taaza Milk
    session_obj = crud.create_shopping_session(
        db,
        session_id="test_sess_123",
        items=[
            schemas.SessionItemCreate(product_id=product.id, quantity=1)
        ]
    )
    db.close()

    # 3. Invoke API endpoint POST /api/v1/verification/verify
    payload = {
        "session_id": "test_sess_123",
        "actual_weight": 1.03,
        "detected_products": [],
        "barcode_results": []
    }

    response = client.post("/api/v1/verification/verify", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    print("POST /api/v1/verification/verify Response:")
    print(json.dumps(data, indent=2))

    assert data["status"] == "REVIEW"
    assert data["risk_score"] == 0.35
    assert data["expected"]["weight"] == 1.0
    assert data["expected"]["amount"] == 62
    assert data["actual"]["weight"] == 1.03
    assert data["actual"]["amount"] == 62
    assert data["differences"]["weight"] == 0.03
    assert data["differences"]["amount"] == 0

    # 4. Verify DB verification log record was created
    db_test = TestingSessionLocal()
    logs = db_test.query(models.VerificationLog).filter(models.VerificationLog.session_id == "test_sess_123").all()
    assert len(logs) == 1
    log_rec = logs[0]
    assert log_rec.status == "REVIEW"
    assert log_rec.risk_score == 0.35
    assert "0.03" in log_rec.differences_json
    db_test.close()

    app.dependency_overrides.clear()
    print("API Endpoint & DB Logging Test: PASSED")


if __name__ == "__main__":
    test_verification_engine_prompt_example()
    test_verification_engine_pass_status()
    test_verification_engine_fail_scenarios()
    test_verification_api_and_db_logging()
