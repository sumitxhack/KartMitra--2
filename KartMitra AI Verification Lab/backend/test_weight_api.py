import os
import json
from app.weight_service import (
    BaseWeightService,
    MockWeightService,
    RealHardwareWeightService,
    get_weight_service,
)
from app.schemas import MockWeightRequest
from app.routers.verification import verify_mock_weight


def test_weight_service_interface():
    print("\n--- 1. Testing BaseWeightService Polymorphism & Interface ---")
    mock_service = MockWeightService(tolerance_kg=0.05)
    hardware_service = RealHardwareWeightService(tolerance_kg=0.05)

    assert isinstance(mock_service, BaseWeightService)
    assert isinstance(hardware_service, BaseWeightService)
    print("Weight Service Polymorphism Test: PASSED")


def test_mock_weight_service_presets():
    print("\n--- 2. Testing Mock Weight Service Presets & Difference Calculations ---")
    service = MockWeightService(tolerance_kg=0.05)

    # 1. Exact match (0% offset)
    res_exact = service.verify_weight(expected_weight=1.0, actual_weight=1.0)
    assert res_exact["expected_weight"] == 1.0
    assert res_exact["actual_weight"] == 1.0
    assert res_exact["difference"] == 0.0
    assert res_exact["within_tolerance"] is True
    assert res_exact["status"] == "MATCH"

    # 2. +1% offset (1.0 -> 1.01, diff = 0.01 <= 0.05)
    res_1 = service.verify_weight(expected_weight=1.0, actual_weight=1.01)
    assert res_1["difference"] == 0.01
    assert res_1["within_tolerance"] is True
    assert res_1["status"] == "MATCH"

    # 3. +3% offset (1.0 -> 1.03, diff = 0.03 <= 0.05) -> Prompt example!
    res_3 = service.verify_weight(expected_weight=1.0, actual_weight=1.03)
    assert res_3["expected_weight"] == 1.0
    assert res_3["actual_weight"] == 1.03
    assert res_3["difference"] == 0.03
    assert res_3["within_tolerance"] is True
    assert res_3["status"] == "MATCH"

    # 4. +5% offset (1.0 -> 1.05, diff = 0.05 <= 0.05)
    res_5 = service.verify_weight(expected_weight=1.0, actual_weight=1.05)
    assert res_5["difference"] == 0.05
    assert res_5["within_tolerance"] is True
    assert res_5["status"] == "MATCH"

    # 5. +10% offset (1.0 -> 1.10, diff = 0.10 > 0.05)
    res_10 = service.verify_weight(expected_weight=1.0, actual_weight=1.10)
    assert res_10["difference"] == 0.10
    assert res_10["within_tolerance"] is False
    assert res_10["status"] == "MISMATCH"

    # 6. +20% offset (1.0 -> 1.20, diff = 0.20 > 0.05)
    res_20 = service.verify_weight(expected_weight=1.0, actual_weight=1.20)
    assert res_20["difference"] == 0.20
    assert res_20["within_tolerance"] is False
    assert res_20["status"] == "MISMATCH"

    print("Mock Weight Presets Test: PASSED")


def test_configurable_tolerance():
    print("\n--- 3. Testing Configurable Tolerance (WEIGHT_TOLERANCE_KG) ---")
    # Custom tolerance: 0.10 kg
    service_custom = MockWeightService(tolerance_kg=0.10)
    res = service_custom.verify_weight(expected_weight=1.0, actual_weight=1.08)
    assert res["difference"] == 0.08
    assert res["within_tolerance"] is True
    assert res["tolerance_kg"] == 0.10
    assert res["status"] == "MATCH"

    # Verify fallback env variable loading
    os.environ["WEIGHT_TOLERANCE_KG"] = "0.02"
    service_env = MockWeightService()
    assert service_env.tolerance_kg == 0.02
    res_env = service_env.verify_weight(expected_weight=1.0, actual_weight=1.03)
    assert res_env["within_tolerance"] is False
    assert res_env["status"] == "MISMATCH"

    # Restore default env variable
    os.environ["WEIGHT_TOLERANCE_KG"] = "0.05"
    print("Configurable Tolerance Test: PASSED")


def test_api_contract_response():
    print("\n--- 4. Testing POST /api/v1/verification/mock-weight API Response Contract ---")
    req = MockWeightRequest(expected_weight=1.0, actual_weight=1.03)
    res = verify_mock_weight(req)

    print("Endpoint response dict:")
    print(json.dumps(res, indent=2))

    # Verify exact JSON keys required by prompt
    assert "expected_weight" in res
    assert "actual_weight" in res
    assert "difference" in res

    assert res["expected_weight"] == 1.0
    assert res["actual_weight"] == 1.03
    assert res["difference"] == 0.03
    assert res["within_tolerance"] is True
    assert res["status"] == "MATCH"

    print("API Response Contract Test: PASSED")


if __name__ == "__main__":
    test_weight_service_interface()
    test_mock_weight_service_presets()
    test_configurable_tolerance()
    test_api_contract_response()
