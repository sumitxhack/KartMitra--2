import express from "express";

import {
  startCheckout,
  verifyCartWeight,
} from "../services/checkoutService.js";

const router = express.Router();

/**
 * POST /api/checkout/:sessionId
 *
 * Start checkout for a cart.
 */
router.post("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await startCheckout(sessionId);

    return res.status(200).json({
      success: true,
      message: "Checkout started. Waiting for weight verification",
      data: result,
    });
  } catch (error) {
    console.error("Start checkout error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to start checkout",
    });
  }
});

/**
 * POST /api/checkout/:sessionId/verify-weight
 *
 * Verify the physical cart weight.
 *
 * Body:
 * {
 *   "actualWeight": 1000
 * }
 */
router.post("/:sessionId/verify-weight", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { actualWeight } = req.body;

    const result = await verifyCartWeight(
      sessionId,
      actualWeight
    );

    return res.status(200).json({
      success: true,
      message: result.canPay
        ? "Weight verified successfully. Cart is ready for payment"
        : "Weight verification failed. Manual verification required",
      data: result,
    });
  } catch (error) {
    console.error("Verify cart weight error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to verify cart weight",
    });
  }
});

export default router;