import unittest
import json
from unittest.mock import MagicMock

from app.ai_verifier import AIVerificationService, AIVerificationInput, AIVerificationOutput
from app.verification_engine import VerificationEngine
from app.models import VerificationLog, Base
from app import crud
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


class TestAIVerificationLayer(unittest.TestCase):

    def setUp(self):
        self.ai_service = AIVerificationService()
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        SessionLocal = sessionmaker(bind=self.engine)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_ai_input_output_structure(self):
        """
        Verify AI Input processing and structured output compliance.
        Requirements:
        Input: detected_products, expected_products, expected_weight, actual_weight, 
               expected_amount, actual_amount, barcode_match, vision_confidence
        Output: analysis, confidence, risk_score, recommendation, reason
        """
        ai_input_data = {
            "detected_products": [],
            "expected_products": [],
            "expected_weight": 1.47,
            "actual_weight": 1.75,
            "expected_amount": 121.0,
            "actual_amount": 121.0,
            "barcode_match": True,
            "vision_confidence": 0.91
        }

        output = self.ai_service.analyze(ai_input_data)

        # Assert output has exact required fields
        self.assertIn("analysis", output)
        self.assertIn("confidence", output)
        self.assertIn("risk_score", output)
        self.assertIn("recommendation", output)
        self.assertIn("reason", output)

        # Assert data types & constraints
        self.assertIsInstance(output["analysis"], str)
        self.assertIsInstance(output["confidence"], float)
        self.assertIsInstance(output["risk_score"], float)
        self.assertIsInstance(output["recommendation"], str)
        self.assertIsInstance(output["reason"], str)

        self.assertTrue(0.0 <= output["confidence"] <= 1.0)
        self.assertTrue(0.0 <= output["risk_score"] <= 1.0)
        self.assertIn(output["recommendation"], ["PASS", "REVIEW", "FAIL"])
        self.assertEqual(output["recommendation"], "FAIL")
        self.assertEqual(output["reason"], "Significant weight mismatch")

    def test_ai_layer_does_not_modify_state(self):
        """
        Verify that AI Analysis service purely computes structured analysis 
        without side effects or state modifications.
        """
        ai_input_data = {
            "detected_products": ["prod_1"],
            "expected_products": ["prod_1"],
            "expected_weight": 1.0,
            "actual_weight": 1.0,
            "expected_amount": 50.0,
            "actual_amount": 50.0,
            "barcode_match": True,
            "vision_confidence": 0.95
        }

        db_count_before = self.db.query(VerificationLog).count()
        output = self.ai_service.analyze(ai_input_data)
        db_count_after = self.db.query(VerificationLog).count()

        # AI verifier itself must not write to DB or change state
        self.assertEqual(db_count_before, db_count_after)
        self.assertEqual(output["recommendation"], "PASS")

    def test_backend_controls_final_decision(self):
        """
        Verify that final decision is governed by backend verification rules.
        """
        verification_engine = VerificationEngine(weight_tolerance_kg=0.05)
        
        session_data = {
            "status": "ACTIVE",
            "items": [
                {"product_id": "P1", "barcode": "12345", "weight": 1.0, "price": 10.0, "quantity": 1}
            ]
        }
        
        # Scenario: scale reading exceeds tolerance by 0.5 kg (1.5 kg vs 1.0 kg expected)
        res = verification_engine.verify(
            session_data=session_data,
            actual_weight=1.5,
            detected_products=["12345"],
            barcode_results=["12345"]
        )

        # Backend rule must enforce status = FAIL due to weight check failure
        self.assertEqual(res["status"], "FAIL")
        self.assertFalse(res["checks"]["weight"])
        self.assertIn("ai_analysis", res)
        self.assertEqual(res["ai_analysis"]["recommendation"], "FAIL")

    def test_logging_ai_output_in_verification_logs(self):
        """
        Verify that AI analysis output is logged into verification_logs DB table.
        """
        verification_result = {
            "status": "FAIL",
            "risk_score": 0.88,
            "checks": {"session": True, "weight": False},
            "expected": {"weight": 1.47, "amount": 121},
            "actual": {"weight": 1.75, "amount": 121},
            "differences": {"weight": 0.28, "amount": 0},
            "reasons": ["Weight mismatch"],
            "ai_analysis": {
                "analysis": "Significant weight mismatch detected.",
                "confidence": 0.94,
                "risk_score": 0.88,
                "recommendation": "FAIL",
                "reason": "Significant weight mismatch"
            }
        }

        request_payload = {
            "session_id": "test_session_123",
            "actual_weight": 1.75
        }

        log_entry = crud.log_verification_attempt(
            db=self.db,
            session_id="test_session_123",
            verification_result=verification_result,
            request_payload=request_payload
        )

        self.assertIsNotNone(log_entry.id)
        self.assertIsNotNone(log_entry.ai_analysis_json)
        
        ai_logged_data = json.loads(log_entry.ai_analysis_json)
        self.assertEqual(ai_logged_data["confidence"], 0.94)
        self.assertEqual(ai_logged_data["risk_score"], 0.88)
        self.assertEqual(ai_logged_data["recommendation"], "FAIL")
        self.assertEqual(ai_logged_data["reason"], "Significant weight mismatch")


if __name__ == "__main__":
    unittest.main()
