import express from "express";
import { processPayment } from "../services/paymentService.js";

const router = express.Router();

/**
 * POST /api/payments/:sessionId
 *
 * Process payment for a verified cart.
 */
router.post("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await processPayment(sessionId);

    return res.status(200).json({
      success: true,
      message: "Payment successful",
      data: result,
    });
  } catch (error) {
    console.error("Payment error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Payment failed",
    });
  }
});

export default router;