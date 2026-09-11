import os
import json
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class AIVerificationInput(BaseModel):
    detected_products: List[Any] = Field(default_factory=list)
    expected_products: List[Any] = Field(default_factory=list)
    expected_weight: float = Field(..., ge=0)
    actual_weight: float = Field(..., ge=0)
    expected_amount: float = Field(..., ge=0)
    actual_amount: float = Field(..., ge=0)
    barcode_match: bool = True
    vision_confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class AIVerificationOutput(BaseModel):
    analysis: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    risk_score: float = Field(..., ge=0.0, le=1.0)
    recommendation: str  # PASS, REVIEW, FAIL
    reason: str


class AIVerificationService:
    """
    AI-Assisted Verification Analysis Layer.
    
    Provides AI analysis, risk scoring, confidence estimation, and recommendations
    based on deterministic verification inputs.
    
    GUARANTEE: This service only returns structured analysis data. It DOES NOT modify 
    cart, payment, product, or database state.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")

    def analyze(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform AI analysis on verification payload.
        
        :param data: Dictionary conforming to AIVerificationInput schema.
        :return: Dictionary matching AIVerificationOutput schema.
        """
        # Validate input structure
        validated_input = AIVerificationInput(**data)

        # Optional LLM call when API key is configured
        if self.api_key:
            llm_result = self._call_llm_analysis(validated_input)
            if llm_result:
                return llm_result.model_dump()

        # Built-in AI Evaluation Engine fallback
        output = self._heuristic_ai_analysis(validated_input)
        return output.model_dump()

    def _heuristic_ai_analysis(self, inp: AIVerificationInput) -> AIVerificationOutput:
        """
        Rule-backed AI Evaluation Engine that produces structured risk scores, 
        confidence, and analysis explanations.
        """
        weight_diff = abs(inp.actual_weight - inp.expected_weight)
        amount_diff = abs(inp.actual_amount - inp.expected_amount)
        
        reasons: List[str] = []
        analysis_parts: List[str] = []
        risk_components: List[float] = []

        # 1. Weight Analysis
        if weight_diff > 0.05:
            weight_risk = min(1.0, round(weight_diff / 0.3, 2))
            risk_components.append(weight_risk)
            reasons.append("Significant weight mismatch")
            analysis_parts.append(
                f"Weight discrepancy detected: scale measured {inp.actual_weight:.2f}kg vs expected {inp.expected_weight:.2f}kg (diff: {weight_diff:.2f}kg)."
            )
        elif weight_diff > 0.01:
            weight_risk = 0.25
            risk_components.append(weight_risk)
            reasons.append("Minor weight variance within threshold")
            analysis_parts.append(
                f"Minor weight difference observed: {weight_diff:.2f}kg."
            )
        else:
            analysis_parts.append("Weight matches expected total precisely.")

        # 2. Barcode & Product Match Analysis
        if not inp.barcode_match:
            risk_components.append(0.75)
            reasons.append("Barcode scan inconsistency")
            analysis_parts.append("Scanned items do not correspond to active shopping cart products.")
        else:
            analysis_parts.append("Barcode scan matches expected cart products.")

        # 3. Vision Confidence Analysis
        if inp.vision_confidence < 0.60:
            vision_risk = round(0.80 - inp.vision_confidence * 0.5, 2)
            risk_components.append(vision_risk)
            reasons.append("Low vision model confidence")
            analysis_parts.append(f"Computer vision confidence is low ({inp.vision_confidence:.2f}).")
        elif inp.vision_confidence < 0.85:
            analysis_parts.append(f"Computer vision confidence is moderate ({inp.vision_confidence:.2f}).")
        else:
            analysis_parts.append(f"Computer vision confidence is high ({inp.vision_confidence:.2f}).")

        # 4. Monetary Amount Analysis
        if amount_diff > 0.01:
            risk_components.append(0.60)
            reasons.append("Cart monetary amount mismatch")
            analysis_parts.append(f"Monetary value mismatch: actual {inp.actual_amount} vs expected {inp.expected_amount}.")

        # 5. Product Set Comparison Analysis
        detected_set = set(
            (x.get("barcode") or x.get("name") or str(x)) if isinstance(x, dict) else str(x)
            for x in inp.detected_products
        )
        expected_set = set(str(x) for x in inp.expected_products)
        if detected_set and expected_set and detected_set != expected_set:
            risk_components.append(0.40)
            analysis_parts.append(f"Detected items set ({len(detected_set)}) differs from expected set ({len(expected_set)}).")

        # Calculate Combined Risk Score & Confidence
        if risk_components:
            ai_risk_score = round(min(1.0, max(risk_components)), 2)
        else:
            ai_risk_score = 0.0

        # Confidence is derived from model inputs and data alignment
        conf_factors = [inp.vision_confidence]
        if inp.barcode_match:
            conf_factors.append(0.95)
        else:
            conf_factors.append(0.70)
        
        ai_confidence = round(sum(conf_factors) / len(conf_factors), 2)

        # Recommendation logic
        if ai_risk_score >= 0.70:
            recommendation = "FAIL"
        elif ai_risk_score >= 0.30:
            recommendation = "REVIEW"
        else:
            recommendation = "PASS"

        primary_reason = reasons[0] if reasons else "All AI verification indicators aligned"
        analysis_summary = " ".join(analysis_parts)

        return AIVerificationOutput(
            analysis=analysis_summary,
            confidence=ai_confidence,
            risk_score=ai_risk_score,
            recommendation=recommendation,
            reason=primary_reason
        )

    def _call_llm_analysis(self, inp: AIVerificationInput) -> Optional[AIVerificationOutput]:
        """Optional Gemini LLM integration for natural language risk analysis."""
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            prompt = f"""
            Analyze the following self-checkout verification data and evaluate discrepancy risk.
            Input:
            {json.dumps(inp.model_dump(), indent=2)}

            Respond ONLY with a JSON object containing:
            - analysis (string): Detailed reasoning
            - confidence (float between 0.0 and 1.0)
            - risk_score (float between 0.0 and 1.0)
            - recommendation (string: PASS, REVIEW, or FAIL)
            - reason (string: concise summary)
            """
            
            response = model.generate_content(prompt)
            content = response.text.strip()
            # Extract JSON from response if needed
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
                
            parsed = json.loads(content)
            return AIVerificationOutput(**parsed)
        except Exception:
            return None
