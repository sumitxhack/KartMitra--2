import express from "express";

import {
  generateExitToken,
  validateExitToken,
} from "../services/exitService.js";

const router = express.Router();

// POST /api/exit/:sessionId/generate
router.post("/:sessionId/generate", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await generateExitToken(sessionId);

    return res.status(200).json({
      success: true,
      message: "Exit QR generated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Generate exit token error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to generate exit QR",
    });
  }
});

// POST /api/exit/validate
router.post("/validate", async (req, res) => {
  try {
    const { token } = req.body;

    const result = await validateExitToken(token);

    return res.status(200).json({
      success: true,
      message: "Exit QR validated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Validate exit token error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to validate exit QR",
    });
  }
});

export default router;