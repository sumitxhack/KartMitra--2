import express from "express";

import {
  verifyCameraProduct,
} from "../services/cameraVerificationService.js";

const router = express.Router();

/**
 * POST /api/camera/verify
 *
 * Body:
 * {
 *   "sessionId": "...",
 *   "scannedBarcode": "8901234567890",
 *   "detectedBarcode": "8901234567890"
 * }
 */
router.post("/verify", async (req, res) => {
  try {
    const {
      sessionId,
      scannedBarcode,
      detectedBarcode,
    } = req.body;

    const result = await verifyCameraProduct(
      sessionId,
      scannedBarcode,
      detectedBarcode
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    console.error("Camera verification error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || "Camera verification failed",
    });
  }
});

export default router;