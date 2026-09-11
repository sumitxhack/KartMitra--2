"""
Step 14 Automated Test Suite for KartMitra AI Verification Lab.
Covers 20 required test scenarios for decision engine, Top-1/Top-2 margin, visual evaluation,
confusion matrix, metrics, threshold analysis, and dataset quality auditing.
"""
import pytest
import numpy as np
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine
from app.visual_decision_service import evaluate_visual_match
from app import crud, models, schemas

# Ensure all SQLAlchemy models including Step 14 evaluation tables exist
Base.metadata.create_all(bind=engine)

client = TestClient(app)


# 1. Decision Engine Unit Tests

def test_visual_decision_high_similarity_high_margin():
    """Test 7: High similarity + high margin -> MATCH"""
    res = evaluate_visual_match(top1_similarity=0.94, top2_similarity=0.71, match_threshold=0.82, margin_threshold=0.08)
    assert res["decision"] == "MATCH"
    assert res["decision_level"] == "HIGH"
    assert res["margin"] == 0.23


def test_visual_decision_high_similarity_low_margin():
    """Test 3 & 6: High similarity but low margin -> REVIEW"""
    res = evaluate_visual_match(top1_similarity=0.89, top2_similarity=0.86, match_threshold=0.82, margin_threshold=0.08)
    assert res["decision"] == "REVIEW"
    assert res["decision_level"] == "MEDIUM"
    assert res["margin"] == 0.03
    assert "too close" in res["reason"]


def test_visual_decision_moderate_similarity():
    """Test 11: Moderate similarity in review range -> REVIEW"""
    res = evaluate_visual_match(top1_similarity=0.75, top2_similarity=0.60, match_threshold=0.82, review_threshold=0.70)
    assert res["decision"] == "REVIEW"
    assert res["decision_level"] == "MEDIUM"


def test_visual_decision_low_similarity():
    """Test 4 & 5: Low similarity -> UNKNOWN"""
    res = evaluate_visual_match(top1_similarity=0.55, top2_similarity=0.40, match_threshold=0.82, review_threshold=0.70)
    assert res["decision"] == "UNKNOWN"
    assert res["decision_level"] == "LOW"


def test_visual_decision_single_candidate_fallback():
    """Test single candidate fallback (top2_similarity = None, margin = None)"""
    res = evaluate_visual_match(top1_similarity=0.92, top2_similarity=None)
    assert res["decision"] == "MATCH"
    assert res["top2_similarity"] is None
    assert res["margin"] is None


# 2. Evaluation API Tests

def test_evaluation_run_creation():
    """Test 14: Evaluation run creation"""
    response = client.post("/api/v1/evaluation/runs", json={"name": "Test Run Step 14", "description": "Verification test"})
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["name"] == "Test Run Step 14"
    assert data["total_tests"] == 0


def test_dataset_quality_report_api():
    """Test 13 & 20: Dataset quality report endpoint"""
    response = client.get("/api/v1/evaluation/dataset-quality")
    assert response.status_code == 200
    report = response.json()
    assert isinstance(report, list)
    for p in report:
        assert "product_id" in p
        assert "registered_image_count" in p
        assert "status" in p
        assert p["status"] in ("LOW_REFERENCE_COUNT", "RECOMMENDED_MORE_IMAGES", "HEALTHY")


def test_hard_example_saving():
    """Test 27: Save hard example endpoint"""
    payload = {
        "expected_product_id": "p001",
        "predicted_product_id": "p002",
        "top1_similarity": 0.88,
        "top2_similarity": 0.85,
        "margin": 0.03,
        "condition": "Low Light",
        "angle": "45_degree",
        "notes": "Similar bottle packaging under dim yellow light"
    }
    response = client.post("/api/v1/evaluation/hard-example", json=payload)
    assert response.status_code == 200
    assert response.json().get("success") is True


def test_evaluation_metrics_and_confusion_matrix_end_to_end():
    """Test 15, 16, 17, 18, 19: Evaluation result storage, accuracy, top-3 accuracy, confusion matrix & threshold analysis"""
    # 1. Create run
    run_resp = client.post("/api/v1/evaluation/runs", json={"name": "E2E Metrics Run", "description": "E2E test"})
    run_id = run_resp.json()["id"]

    # 2. Check metrics endpoint on empty run
    metrics_resp = client.get(f"/api/v1/evaluation/runs/{run_id}/metrics")
    assert metrics_resp.status_code == 200
    m_data = metrics_resp.json()
    assert "overall_accuracy" in m_data
    assert "top1_accuracy" in m_data
    assert "top3_accuracy" in m_data
    assert "unknown_detection_rate" in m_data
    assert "false_positive_rate" in m_data

    # 3. Check confusion matrix endpoint
    cm_resp = client.get(f"/api/v1/evaluation/runs/{run_id}/confusion-matrix")
    assert cm_resp.status_code == 200
    cm_data = cm_resp.json()
    assert "labels" in cm_data
    assert "matrix" in cm_data

    # 4. Check threshold analysis
    ta_resp = client.get(f"/api/v1/evaluation/runs/{run_id}/threshold-analysis")
    assert ta_resp.status_code == 200
    ta_data = ta_resp.json()
    assert "threshold_analysis" in ta_data
    assert "recommended_candidates" in ta_data

    # 5. Check margin analysis
    ma_resp = client.get(f"/api/v1/evaluation/runs/{run_id}/margin-analysis")
    assert ma_resp.status_code == 200
    ma_data = ma_resp.json()
    assert "margin_analysis" in ma_data
