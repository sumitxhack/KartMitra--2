import os
from typing import Dict, Any, List, Optional
from decimal import Decimal


class VerificationEngine:
    """
    Deterministic Verification Engine for KartMitra.
    Does NOT use AI for core mathematical / business validation.
    
    Performs 10 core verification checks:
    1. Session validity
    2. Product existence
    3. Barcode consistency
    4. Vision product consistency
    5. Quantity consistency
    6. Expected amount
    7. Actual amount
    8. Expected weight
    9. Actual weight
    10. Weight tolerance
    """

    def __init__(self, weight_tolerance_kg: Optional[float] = None):
        if weight_tolerance_kg is None:
            weight_tolerance_kg = float(os.getenv("WEIGHT_TOLERANCE_KG", "0.05"))
        self.weight_tolerance_kg = weight_tolerance_kg

    def verify(
        self,
        session_data: Optional[Dict[str, Any]],
        actual_weight: float,
        detected_products: List[Any],
        barcode_results: List[Any],
        catalog_products: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Execute deterministic verification logic on session, vision, barcode, and scale data.

        :param session_data: Dictionary containing session info & cart items, or None if invalid.
        :param actual_weight: Measured weight from scale sensor in kg.
        :param detected_products: Vision system detection outputs.
        :param barcode_results: Scanned barcode results.
        :param catalog_products: Dictionary mapping product barcode/id -> product info dict.
        :return: Dict matching exact VerificationResponse schema.
        """
        reasons: List[str] = []
        checks = {
            "session": True,
            "barcode": True,
            "vision": True,
            "product": True,
            "quantity": True,
            "amount": True,
            "weight": True,
        }

        catalog = catalog_products or {}

        # 1. Check Session Validity
        if not session_data or session_data.get("status") not in ["ACTIVE", "active", "OPEN", "open"]:
            checks["session"] = False
            reasons.append("Invalid or inactive shopping session.")
            expected_cart_items: List[Dict[str, Any]] = []
        else:
            expected_cart_items = session_data.get("items", [])

        # Parse cart items into expected structure
        # Expected totals calculation
        expected_weight = 0.0
        expected_amount = 0.0
        expected_qty_by_barcode: Dict[str, int] = {}
        expected_products_set = set()

        for item in expected_cart_items:
            qty = item.get("quantity", 1)
            p_weight = float(item.get("weight", 0.0))
            p_price = float(item.get("price", 0.0))
            barcode = item.get("barcode", item.get("product_id", ""))

            expected_weight += p_weight * qty
            expected_amount += p_price * qty
            if barcode:
                expected_qty_by_barcode[barcode] = expected_qty_by_barcode.get(barcode, 0) + qty
                expected_products_set.add(barcode)

        # Helper to parse barcode results
        scanned_qty_by_barcode: Dict[str, int] = {}
        for b in barcode_results:
            if isinstance(b, str):
                scanned_qty_by_barcode[b] = scanned_qty_by_barcode.get(b, 0) + 1
            elif isinstance(b, dict):
                b_code = b.get("barcode") or b.get("id") or b.get("product_id")
                b_qty = b.get("quantity", 1)
                if b_code:
                    scanned_qty_by_barcode[b_code] = scanned_qty_by_barcode.get(b_code, 0) + b_qty

        # Helper to parse vision detected products & check confidence / unknown status
        vision_qty_by_identifier: Dict[str, int] = {}
        has_low_conf_vision = False
        has_unknown_vision = False

        for v in detected_products:
            if isinstance(v, str):
                vision_qty_by_identifier[v] = vision_qty_by_identifier.get(v, 0) + 1
            elif isinstance(v, dict):
                conf = v.get("confidence")
                if conf is not None:
                    try:
                        if float(conf) < 0.60 or v.get("is_low_confidence", False):
                            has_low_conf_vision = True
                    except (TypeError, ValueError):
                        pass

                if v.get("is_unknown", False) or v.get("product_id") is None and not v.get("barcode") and not v.get("name"):
                    has_unknown_vision = True

                v_id = v.get("barcode") or v.get("product_id") or v.get("class_name") or v.get("name")
                v_qty = v.get("quantity", 1)
                if v_id:
                    vision_qty_by_identifier[v_id] = vision_qty_by_identifier.get(v_id, 0) + v_qty

        # 2. Check Product Existence & Catalog Consistency
        if not expected_cart_items:
            checks["product"] = False
        for b_code in scanned_qty_by_barcode:
            if catalog and b_code not in catalog and b_code not in expected_qty_by_barcode:
                checks["product"] = False
                checks["barcode"] = False
                reasons.append(f"Scanned barcode '{b_code}' does not exist in catalog.")

        # 3. Check Barcode Consistency with Session Cart
        if scanned_qty_by_barcode:
            if set(scanned_qty_by_barcode.keys()) != set(expected_qty_by_barcode.keys()):
                checks["barcode"] = False
                reasons.append("Scanned barcodes do not match session cart products.")

        # 4. Check Vision Product Consistency
        if has_low_conf_vision:
            checks["vision"] = False
            reasons.append("Vision detection contains low-confidence detection(s) below threshold.")

        if has_unknown_vision:
            checks["vision"] = False
            reasons.append("Vision detected unknown or unregistered product.")

        if vision_qty_by_identifier:
            # Resolve vision identifiers to barcodes if catalog mapping exists
            resolved_vision_barcodes: Dict[str, int] = {}
            for v_key, qty in vision_qty_by_identifier.items():
                matched_barcode = None
                if v_key in catalog:
                    matched_barcode = v_key
                else:
                    for b_code, prod_info in catalog.items():
                        if v_key.lower() in prod_info.get("name", "").lower() or v_key.lower() in prod_info.get("category", "").lower():
                            matched_barcode = b_code
                            break
                
                target_key = matched_barcode if matched_barcode else v_key
                resolved_vision_barcodes[target_key] = resolved_vision_barcodes.get(target_key, 0) + qty

            if set(resolved_vision_barcodes.keys()) != set(expected_qty_by_barcode.keys()):
                checks["vision"] = False
                reasons.append("Vision detected products do not match session cart items.")

        # 5. Check Quantity Consistency
        if scanned_qty_by_barcode and scanned_qty_by_barcode != expected_qty_by_barcode:
            checks["quantity"] = False
            reasons.append("Quantity mismatch between barcode scans and cart items.")

        # Calculate Actual Amount & Weight
        # Actual amount is derived from scanned/detected items if present, else expected if matches
        actual_amount = 0.0
        if scanned_qty_by_barcode:
            for b_code, qty in scanned_qty_by_barcode.items():
                p_info = catalog.get(b_code, {})
                price = float(p_info.get("price", 0.0))
                if price == 0.0 and b_code in expected_qty_by_barcode:
                    # Lookup price from expected cart item
                    for item in expected_cart_items:
                        if item.get("barcode") == b_code or item.get("product_id") == b_code:
                            price = float(item.get("price", 0.0))
                            break
                actual_amount += price * qty
        else:
            actual_amount = expected_amount

        # 6 & 7. Check Amount Consistency
        amount_diff = round(actual_amount - expected_amount, 2)
        if abs(amount_diff) > 0.01:
            checks["amount"] = False
            reasons.append(f"Monetary amount mismatch (Expected: {expected_amount}, Actual: {actual_amount}).")

        # 8, 9 & 10. Check Weight Consistency & Tolerance
        expected_weight = round(expected_weight, 4)
        actual_weight = round(actual_weight, 4)
        weight_diff = round(abs(actual_weight - expected_weight), 4)

        if weight_diff > self.weight_tolerance_kg:
            checks["weight"] = False
            reasons.append(f"Actual weight difference ({weight_diff} kg) exceeds tolerance ({self.weight_tolerance_kg} kg).")

        # Deterministic Risk Score Calculation
        deterministic_risk_score = 0.0
        if not checks["session"]:
            deterministic_risk_score += 0.50
        if not checks["barcode"]:
            deterministic_risk_score += 0.25
        if not checks["vision"]:
            deterministic_risk_score += 0.20
        if not checks["quantity"]:
            deterministic_risk_score += 0.20
        if not checks["amount"]:
            deterministic_risk_score += 0.25
        if not checks["weight"]:
            deterministic_risk_score += 0.40
        else:
            # Weight is within tolerance, but if there is minor variance
            if weight_diff > 0:
                deterministic_risk_score += round((weight_diff / 0.03) * 0.35, 2)

        deterministic_risk_score = round(min(1.0, deterministic_risk_score), 2)

        # Build AI Analysis Layer Input Payload
        vision_confidences = []
        for item in detected_products:
            if isinstance(item, dict) and "confidence" in item:
                try:
                    vision_confidences.append(float(item["confidence"]))
                except (TypeError, ValueError):
                    pass

        avg_vision_conf = (
            round(sum(vision_confidences) / len(vision_confidences), 2)
            if vision_confidences
            else (0.91 if detected_products else 1.0)
        )

        expected_products_list = [
            item.get("barcode") or item.get("name") or item.get("product_id")
            for item in expected_cart_items
        ] if expected_cart_items else []

        ai_input = {
            "detected_products": detected_products,
            "expected_products": expected_products_list,
            "expected_weight": expected_weight,
            "actual_weight": actual_weight,
            "expected_amount": expected_amount,
            "actual_amount": actual_amount,
            "barcode_match": checks["barcode"],
            "vision_confidence": avg_vision_conf,
        }

        # Execute AI Analysis Layer (strictly advisory, no state mutation)
        from app.ai_verifier import AIVerificationService
        ai_service = AIVerificationService()
        ai_output = ai_service.analyze(ai_input)

        # Backend Verification Business Rules: synthesize final risk score & status
        # Final decision is governed strictly by backend rules, not AI direct override.
        final_risk_score = round(min(1.0, max(deterministic_risk_score, ai_output["risk_score"])), 2)

        if not checks["session"] or not checks["weight"] or final_risk_score >= 0.50 or ai_output["recommendation"] == "FAIL":
            status = "FAIL"
        elif final_risk_score == 0.0 and all(checks.values()) and ai_output["recommendation"] == "PASS":
            status = "PASS"
        else:
            status = "REVIEW"

        return {
            "status": status,
            "risk_score": final_risk_score,
            "checks": checks,
            "expected": {
                "weight": expected_weight,
                "amount": int(expected_amount) if expected_amount.is_integer() else round(expected_amount, 2)
            },
            "actual": {
                "weight": actual_weight,
                "amount": int(actual_amount) if actual_amount.is_integer() else round(actual_amount, 2)
            },
            "differences": {
                "weight": weight_diff,
                "amount": int(amount_diff) if amount_diff.is_integer() else round(amount_diff, 2)
            },
            "reasons": reasons,
            "ai_analysis": ai_output,
        }
