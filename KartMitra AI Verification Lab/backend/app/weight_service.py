import os
from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseWeightService(ABC):
    """
    Abstract base class defining the weight verification service interface.
    Allows seamlessly replacing MockWeightService with RealHardwareWeightService
    without changing the verification API contract.
    """

    @abstractmethod
    def verify_weight(self, expected_weight: float, actual_weight: float) -> Dict[str, Any]:
        """
        Verify the measured weight against expected product weight.

        :param expected_weight: Expected product weight in kg
        :param actual_weight: Measured/actual product weight in kg
        :return: Dict containing verification results matching API contract
        """
        pass


class MockWeightService(BaseWeightService):
    """
    Mock weight simulation service. Does not require physical hardware.
    Uses configurable tolerance from WEIGHT_TOLERANCE_KG env variable.
    """

    def __init__(self, tolerance_kg: float = None):
        if tolerance_kg is None:
            tolerance_kg = float(os.getenv("WEIGHT_TOLERANCE_KG", "0.05"))
        self.tolerance_kg = tolerance_kg

    def verify_weight(self, expected_weight: float, actual_weight: float) -> Dict[str, Any]:
        difference = round(abs(actual_weight - expected_weight), 4)
        within_tolerance = difference <= self.tolerance_kg
        status = "MATCH" if within_tolerance else "MISMATCH"

        return {
            "expected_weight": round(expected_weight, 4),
            "actual_weight": round(actual_weight, 4),
            "difference": difference,
            "within_tolerance": within_tolerance,
            "tolerance_kg": self.tolerance_kg,
            "status": status,
        }


class RealHardwareWeightService(BaseWeightService):
    """
    Hardware integration service for physical weight scales / load cell sensors.
    Drop-in replacement for MockWeightService.
    """

    def __init__(self, tolerance_kg: float = None):
        if tolerance_kg is None:
            tolerance_kg = float(os.getenv("WEIGHT_TOLERANCE_KG", "0.05"))
        self.tolerance_kg = tolerance_kg

    def read_scale(self) -> float:
        """Read current weight from physical serial/USB scale hardware."""
        raise NotImplementedError("Real hardware weight scale is not connected.")

    def verify_weight(self, expected_weight: float, actual_weight: float) -> Dict[str, Any]:
        difference = round(abs(actual_weight - expected_weight), 4)
        within_tolerance = difference <= self.tolerance_kg
        status = "MATCH" if within_tolerance else "MISMATCH"

        return {
            "expected_weight": round(expected_weight, 4),
            "actual_weight": round(actual_weight, 4),
            "difference": difference,
            "within_tolerance": within_tolerance,
            "tolerance_kg": self.tolerance_kg,
            "status": status,
        }


def get_weight_service() -> BaseWeightService:
    """
    Factory function providing active weight service instance.
    Decouples API routes from specific weight service implementations.
    """
    service_type = os.getenv("WEIGHT_SERVICE_TYPE", "mock").strip().lower()
    if service_type == "hardware":
        return RealHardwareWeightService()
    return MockWeightService()
