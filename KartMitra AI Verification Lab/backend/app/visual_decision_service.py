"""
Visual Decision Service for KartMitra AI Verification Lab.
Evaluates model similarity, Top-1/Top-2 margins, classifies MATCH / REVIEW / UNKNOWN,
and computes derived UI decision levels (HIGH / MEDIUM / LOW) and human-readable reasons.
"""
from typing import Dict, Any, Optional
from app import config

def evaluate_visual_match(
    top1_similarity: float,
    top2_similarity: Optional[float] = None,
    match_threshold: Optional[float] = None,
    review_threshold: Optional[float] = None,
    margin_threshold: Optional[float] = None
) -> Dict[str, Any]:
    """
    Evaluates visual recognition decision based on raw Top-1 similarity score and Top-1 vs Top-2 margin.
    Does NOT modify raw similarity or mislabel it as probability.
    """
    m_thresh = match_threshold if match_threshold is not None else config.VISUAL_MATCH_THRESHOLD
    r_thresh = review_threshold if review_threshold is not None else config.VISUAL_REVIEW_THRESHOLD
    mg_thresh = margin_threshold if margin_threshold is not None else config.VISUAL_MARGIN_THRESHOLD

    top1_sim = round(float(top1_similarity), 4)
    top2_sim = round(float(top2_similarity), 4) if top2_similarity is not None else None

    if top2_sim is not None:
        margin = round(top1_sim - top2_sim, 4)
    else:
        margin = None

    decision: str = "UNKNOWN"
    decision_level: str = "LOW"
    reason: str = "No registered product has sufficient visual similarity."

    # CASE 1 & CASE 2: High Top-1 similarity (>= MATCH_THRESHOLD)
    if top1_sim >= m_thresh:
        if margin is None or margin >= mg_thresh:
            decision = "MATCH"
            decision_level = "HIGH"
            reason = "High visual similarity with sufficient separation from the second candidate."
        else:
            decision = "REVIEW"
            decision_level = "MEDIUM"
            reason = "Top candidate is strong but too close to the second candidate."

    # CASE 3: Moderate similarity (REVIEW_THRESHOLD <= similarity < MATCH_THRESHOLD)
    elif top1_sim >= r_thresh:
        decision = "REVIEW"
        decision_level = "MEDIUM"
        reason = "Visual similarity is within the review range."

    # CASE 4: Low similarity (< REVIEW_THRESHOLD)
    else:
        decision = "UNKNOWN"
        decision_level = "LOW"
        reason = "No registered product has sufficient visual similarity."

    return {
        "top1_similarity": top1_sim,
        "top2_similarity": top2_sim,
        "margin": margin,
        "decision": decision,
        "decision_level": decision_level,
        "reason": reason
    }
