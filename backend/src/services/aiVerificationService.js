const DEFAULT_AI_URL = "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Custom error class to carry HTTP status codes for the Express layer.
 */
export class AiVerificationError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = "AiVerificationError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Fetch product directly from AI Verification Lab PostgreSQL database.
 * Authoritative single source of truth for products.
 *
 * @param {string} barcode
 * @returns {Promise<Object|null>} Normalized product snapshot or null if not found
 */
export const fetchProductFromAiLab = async (barcode) => {
  if (!barcode) return null;
  const cleanBarcode = String(barcode).trim();
  if (!cleanBarcode) return null;

  const baseUrl = process.env.AI_VERIFICATION_URL || DEFAULT_AI_URL;
  const url = `${baseUrl}/api/v1/products/barcode/${encodeURIComponent(cleanBarcode)}`;

  console.log("[AI Verify] Barcode:", cleanBarcode);
  console.log("[AI Verify] AI Lab URL:", url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 404) {
      console.log("[AI Verify] Product: Not found in AI Lab PostgreSQL for barcode:", cleanBarcode);
      return null;
    }

    if (!response.ok) {
      console.warn(`[AI Verify] AI Lab returned HTTP ${response.status} for barcode: ${cleanBarcode}`);
      return null;
    }

    const json = await response.json();
    const rawProd = json?.product || json?.data || json;

    if (!rawProd || (!rawProd.id && !rawProd.barcode && !rawProd.name)) {
      return null;
    }

    // Resolve primary image if present
    let primaryImage = "";
    if (rawProd.images && Array.isArray(rawProd.images) && rawProd.images.length > 0) {
      const imgPath = rawProd.images[0]?.image_path || rawProd.images[0]?.path || "";
      if (imgPath) {
        primaryImage = imgPath.startsWith("http") ? imgPath : `${baseUrl}${imgPath}`;
      }
    } else if (rawProd.image) {
      primaryImage = rawProd.image.startsWith("http") ? rawProd.image : `${baseUrl}${rawProd.image}`;
    }

    const normalizedProduct = {
      id: rawProd.id || String(rawProd._id || ""),
      barcode: rawProd.barcode || cleanBarcode,
      name: rawProd.name || "Verified Product",
      price: Number(rawProd.price) || 0,
      category: rawProd.category || "General",
      description: rawProd.description || "",
      weight: Number(rawProd.weight) || 0,
      weightUnit: rawProd.weight_unit || rawProd.weightUnit || "kg",
      image: primaryImage,
    };

    console.log("[AI Verify] Product:", normalizedProduct.name, `(${normalizedProduct.barcode})`);
    return normalizedProduct;
  } catch (error) {
    console.warn("[AI Verify] Failed to connect to AI Lab product endpoint:", error.message);
    return null;
  }
};

/**
 * Health check to verify whether AI Lab FastAPI backend is reachable.
 * GET /health on AI Verification Lab.
 *
 * @returns {Promise<{ available: boolean, service: string, details?: any }>}
 */
export const checkAiHealth = async () => {
  const baseUrl = process.env.AI_VERIFICATION_URL || DEFAULT_AI_URL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        available: true,
        service: "ai-verification",
        status: data.status || "ok",
        ai_status: data.ai_status || "UNKNOWN",
      };
    }

    return {
      available: false,
      service: "ai-verification",
      statusCode: response.status,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      available: false,
      service: "ai-verification",
      error: error.message || "Connection refused or timed out",
    };
  }
};

/**
 * Sends image and optional session/barcode parameters to the existing AI Lab
 * unified verification scan endpoint (POST /api/v1/verification/scan),
 * then normalizes the response and maps against AI Verification Lab PostgreSQL via barcode.
 *
 * @param {Object} params
 * @param {Buffer} params.imageBuffer - Raw image buffer
 * @param {string} [params.imageMimeType] - e.g. "image/jpeg"
 * @param {string} [params.originalFilename] - e.g. "frame.jpg"
 * @param {string} [params.scannedBarcode] - Barcode scanned by customer (optional)
 * @param {string} [params.sessionId] - Active shopping session ID (optional)
 * @param {number} [params.timeoutMs] - Request timeout in milliseconds (optional)
 * @returns {Promise<Object>} Normalized KartMitra AI verification response
 */
export const verifyImageWithAi = async ({
  imageBuffer,
  imageMimeType = "image/jpeg",
  originalFilename = "camera_frame.jpg",
  scannedBarcode = null,
  sessionId = "default_session",
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  // 1. Validate image presence
  if (!imageBuffer || !(imageBuffer instanceof Uint8Array || Buffer.isBuffer(imageBuffer)) || imageBuffer.length === 0) {
    throw new AiVerificationError("Image file is required for AI verification", 400);
  }

  const baseUrl = process.env.AI_VERIFICATION_URL || DEFAULT_AI_URL;
  const endpoint = `${baseUrl}/api/v1/verification/scan`;

  // 2. Prepare multipart/form-data for AI Lab FastAPI
  const formData = new FormData();
  const fileBlob = new Blob([imageBuffer], { type: imageMimeType || "image/jpeg" });
  formData.append("file", fileBlob, originalFilename || "camera_frame.jpg");
  formData.append("image", fileBlob, originalFilename || "camera_frame.jpg");

  if (sessionId) {
    formData.append("session_id", String(sessionId));
  }

  const cleanScannedBarcode = typeof scannedBarcode === "string" ? scannedBarcode.trim() : null;
  if (cleanScannedBarcode) {
    formData.append("scanned_barcode", cleanScannedBarcode);
  }

  // 3. Dispatch to FastAPI with timeout & connection error guards
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let rawResponse;
  try {
    rawResponse = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError" || err.message?.includes("aborted")) {
      throw new AiVerificationError(
        `AI verification request timed out after ${timeoutMs}ms`,
        503,
        { code: "AI_TIMEOUT" }
      );
    }

    throw new AiVerificationError(
      `AI verification service is currently unavailable at ${baseUrl}: ${err.message}`,
      503,
      { code: "AI_UNAVAILABLE", originalError: err.message }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // 4. Handle non-2xx HTTP responses from AI Lab
  if (!rawResponse.ok) {
    let errorDetail = `AI Lab returned HTTP ${rawResponse.status}`;
    try {
      const errJson = await rawResponse.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
    } catch {
      // Ignore
    }

    if (rawResponse.status === 422 || rawResponse.status === 400) {
      throw new AiVerificationError(`Invalid request to AI verification service: ${errorDetail}`, 400);
    }

    if (rawResponse.status >= 500) {
      throw new AiVerificationError(
        `AI verification engine encountered an internal error: ${errorDetail}`,
        503
      );
    }

    throw new AiVerificationError(`AI verification service error: ${errorDetail}`, 502);
  }

  // 5. Parse and validate AI Lab response structure
  let aiData;
  try {
    aiData = await rawResponse.json();
  } catch {
    throw new AiVerificationError("Malformed JSON response received from AI verification engine", 502);
  }

  if (!aiData || typeof aiData !== "object") {
    throw new AiVerificationError("Malformed response: expected JSON object from AI verification engine", 502);
  }

  // 6. Extract candidate barcode detected visually in frame
  const candidateBarcode = extractBarcodeFromAiResult(aiData);

  // 7. Authoritative Product Resolution from AI Verification Lab PostgreSQL
  let expectedProduct = null;
  let detectedProduct = null;

  if (cleanScannedBarcode) {
    expectedProduct = await fetchProductFromAiLab(cleanScannedBarcode);
  }

  if (candidateBarcode) {
    if (cleanScannedBarcode && candidateBarcode.trim() === cleanScannedBarcode) {
      detectedProduct = expectedProduct;
    } else {
      detectedProduct = await fetchProductFromAiLab(candidateBarcode);
    }
  }

  let mappedProduct = detectedProduct || expectedProduct;

  if (!mappedProduct) {
    mappedProduct = {
      id: aiData.product?.id || "",
      barcode: candidateBarcode || cleanScannedBarcode || null,
      name: aiData.product?.name || aiData.product_name || (aiData.detections?.[0]?.product_name) || "Identified Product",
      price: Number(aiData.product?.price) || 0,
      category: aiData.product?.category || "General",
      description: aiData.product?.description || "",
      weight: Number(aiData.product?.weight) || 0,
      weightUnit: "kg",
      image: "",
      mapping: !candidateBarcode && !cleanScannedBarcode ? "unresolved" : undefined,
    };
  }

  // 8. Determine Normalized Status: MATCH | MISMATCH | REVIEW | UNKNOWN
  let rawAiStatus = (aiData.status || aiData.frame_status || "UNKNOWN").toUpperCase().trim();
  let normalizedStatus = "UNKNOWN";

  if (rawAiStatus === "MATCH") normalizedStatus = "MATCH";
  else if (rawAiStatus === "MISMATCH") normalizedStatus = "MISMATCH";
  else if (rawAiStatus === "REVIEW") normalizedStatus = "REVIEW";
  else normalizedStatus = "UNKNOWN";

  let finalReason = aiData.reason || "AI verification analysis complete.";
  let recommendedAction = aiData.recommended_action || "SCAN_AGAIN";

  if (cleanScannedBarcode) {
    if (candidateBarcode) {
      if (cleanScannedBarcode === candidateBarcode.trim()) {
        if (normalizedStatus === "UNKNOWN") normalizedStatus = "MATCH";
        finalReason = `Scanned barcode ${cleanScannedBarcode} confirmed by camera AI verification.`;
        recommendedAction = "ADD_TO_CART";
      } else {
        // Scanned barcode differs from visual item detected in frame!
        normalizedStatus = "MISMATCH";
        finalReason = `Barcode mismatch: Expected '${expectedProduct?.name || cleanScannedBarcode}', but camera detected '${detectedProduct?.name || candidateBarcode}'.`;
        recommendedAction = "MANUAL_REVIEW";
      }
    } else {
      if (normalizedStatus === "MATCH") {
        finalReason = `Visual match for '${mappedProduct.name}'. Verify barcode '${cleanScannedBarcode}'.`;
        recommendedAction = "ADD_TO_CART";
      } else if (normalizedStatus === "UNKNOWN") {
        normalizedStatus = "REVIEW";
        finalReason = `Could not visually identify item for scanned barcode '${cleanScannedBarcode}'. Please reposition item in camera.`;
        recommendedAction = "MANUAL_REVIEW";
      }
    }
  }

  if (normalizedStatus === "MATCH" && !recommendedAction) {
    recommendedAction = "ADD_TO_CART";
  } else if (normalizedStatus === "REVIEW" && !recommendedAction) {
    recommendedAction = "MANUAL_REVIEW";
  } else if (normalizedStatus === "MISMATCH" && !recommendedAction) {
    recommendedAction = "MANUAL_REVIEW";
  }

  // 9. Extract detections and signals
  const detections = Array.isArray(aiData.detections) ? aiData.detections : [];
  const signals = aiData.signals || {};
  const confidence = typeof aiData.confidence === "number" ? Number(aiData.confidence.toFixed(3)) : 0;

  // 10. Return strictly normalized KartMitra response format
  return {
    status: normalizedStatus,
    product: mappedProduct,
    expectedProduct: expectedProduct,
    detectedProduct: detectedProduct,
    confidence: confidence,
    signals: signals,
    reason: finalReason,
    recommended_action: recommendedAction,
    detections: detections,
  };
};

/**
 * Extracts candidate barcode from diverse potential fields in the AI Lab response.
 */
function extractBarcodeFromAiResult(aiData) {
  if (aiData.product?.barcode && typeof aiData.product.barcode === "string") {
    return aiData.product.barcode;
  }
  if (aiData.signals?.barcode?.barcode && typeof aiData.signals.barcode.barcode === "string") {
    return aiData.signals.barcode.barcode;
  }
  if (aiData.barcode && typeof aiData.barcode === "string") {
    return aiData.barcode;
  }
  if (aiData.detections && Array.isArray(aiData.detections) && aiData.detections.length > 0) {
    const firstDet = aiData.detections[0];
    if (firstDet.product?.barcode) return firstDet.product.barcode;
    if (firstDet.signals?.barcode?.barcode) return firstDet.signals.barcode.barcode;
    if (firstDet.barcode) return firstDet.barcode;
  }
  if (aiData.cart_summary && Array.isArray(aiData.cart_summary) && aiData.cart_summary.length > 0) {
    if (aiData.cart_summary[0].barcode) return aiData.cart_summary[0].barcode;
  }
  return null;
}
