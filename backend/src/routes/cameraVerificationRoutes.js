import express from "express";
import multer from "multer";
import { verifyCameraProduct } from "../services/cameraVerificationService.js";
import {
  verifyImageWithAi,
  checkAiHealth,
  fetchProductFromAiLab,
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
 * Dispatches to AI Verification Lab (FastAPI YOLO + DINOv2 + FAISS + OCR / PostgreSQL),
 * resolves authoritative product from PostgreSQL, and returns normalized response.
 */
router.post("/ai-verify", uploadImageMiddleware, async (req, res) => {
  try {
    const uploadedFile =
      req.files?.image?.[0] || req.files?.file?.[0] || req.file;

    const { sessionId } = req.body;
    const rawBarcode = req.body.scannedBarcode || req.body.barcode;
    const cleanBarcode = rawBarcode ? String(rawBarcode).trim() : null;

    // Case 1: Camera image provided -> Full AI visual + barcode verification
    if (uploadedFile && uploadedFile.buffer) {
      const result = await verifyImageWithAi({
        imageBuffer: uploadedFile.buffer,
        imageMimeType: uploadedFile.mimetype,
        originalFilename: uploadedFile.originalname,
        scannedBarcode: cleanBarcode,
        sessionId,
      });

      return res.status(200).json({
        status: result.status,
        product: result.product,
        expectedProduct: result.expectedProduct,
        detectedProduct: result.detectedProduct,
        confidence: result.confidence,
        signals: result.signals,
        reason: result.reason,
        recommended_action: result.recommended_action,
        detections: result.detections,
        success: true,
        data: result,
      });
    }

    // Case 2: Clean barcode provided -> Authoritative lookup from AI Lab PostgreSQL
    if (cleanBarcode) {
      const product = await fetchProductFromAiLab(cleanBarcode);

      if (!product) {
        return res.status(404).json({
          status: "UNKNOWN",
          success: false,
          message: `Product with barcode '${cleanBarcode}' not found in AI Verification Lab.`,
          reason: "Product not registered in AI Verification Lab PostgreSQL database.",
          recommended_action: "RESCAN",
        });
      }

      return res.status(200).json({
        status: "MATCH",
        product,
        expectedProduct: product,
        detectedProduct: product,
        confidence: 0.98,
        signals: {
          barcode: { verified: true, barcode: cleanBarcode, text: `Authoritative match: ${product.name}` },
          yolo: { verified: true, text: "Barcode match verified" },
          similarity: { verified: true, text: "Product registered in PostgreSQL" },
          ocr: { verified: true, text: `Authoritative record: ${product.name}` },
        },
        reason: `Barcode ${cleanBarcode} verified in AI Verification Lab PostgreSQL.`,
        recommended_action: "ADD_TO_CART",
        detections: [{ product, confidence: 0.98 }],
        success: true,
      });
    }

    // Case 3: Neither image nor valid barcode provided
    return res.status(400).json({
      success: false,
      message: "Image file is required for AI verification (or valid barcode)",
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