import express from "express";
import multer from "multer";
import { verifyCameraProduct } from "../services/cameraVerificationService.js";
import {
  verifyImageWithAi,
  checkAiHealth,
} from "../services/aiVerificationService.js";

const router = express.Router();

// Configure multer memory storage for handling incoming camera frames
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max camera frame
  },
});

// Middleware accepting "image" or "file" field name
const uploadImageMiddleware = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

/**
 * GET /api/camera/ai-health
 * Checks whether the AI Verification Lab FastAPI backend is reachable.
 *
 * Returns:
 * {
 *   "available": true/false,
 *   "service": "ai-verification"
 * }
 */
router.get("/ai-health", async (req, res) => {
  try {
    const health = await checkAiHealth();
    return res.status(200).json({
      available: Boolean(health.available),
      service: "ai-verification",
    });
  } catch {
    return res.status(200).json({
      available: false,
      service: "ai-verification",
    });
  }
});

/**
 * POST /api/camera/ai-verify
 *
 * Request: multipart/form-data
 * Fields:
 * - image (File) [required]
 * - sessionId (string) [optional]
 * - scannedBarcode (string) [optional]
 *
 * Dispatches to AI Verification Lab (FastAPI YOLO + DINOv2 + FAISS + OCR),
 * cross-references detected barcode against KartMitra MongoDB,
 * and returns the normalized verification response.
 */
router.post("/ai-verify", uploadImageMiddleware, async (req, res) => {
  try {
    // 1. Extract uploaded image
    const uploadedFile =
      req.files?.image?.[0] || req.files?.file?.[0] || req.file;

    if (!uploadedFile || !uploadedFile.buffer) {
      return res.status(400).json({
        success: false,
        message: "Image file is required for AI verification (form field: 'image')",
      });
    }

    const { sessionId, scannedBarcode } = req.body;

    // 2. Call AI verification service
    const result = await verifyImageWithAi({
      imageBuffer: uploadedFile.buffer,
      imageMimeType: uploadedFile.mimetype,
      originalFilename: uploadedFile.originalname,
      scannedBarcode,
      sessionId,
    });

    // 3. Return normalized response (Requirement 6)
    return res.status(200).json({
      status: result.status,
      product: result.product,
      confidence: result.confidence,
      signals: result.signals,
      reason: result.reason,
      recommended_action: result.recommended_action,
      detections: result.detections,
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[cameraVerificationRoutes] /ai-verify error:", error.message);

    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "AI verification failed",
      code: error.details?.code || (statusCode === 503 ? "AI_UNAVAILABLE" : (statusCode === 502 ? "AI_MALFORMED_RESPONSE" : "SERVER_ERROR")),
    });
  }
});

/**
 * POST /api/camera/verify
 * Existing legacy barcode matching endpoint (Preserved as requested in Requirement 9).
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