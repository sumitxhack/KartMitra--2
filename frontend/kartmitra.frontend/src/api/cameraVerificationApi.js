import apiClient from "./client";

/**
 * Sends a captured image and/or barcode to the AI verification endpoint.
 *
 * @param {Object} params
 * @param {Blob|File} [params.imageBlob] - Optional captured image Blob or File
 * @param {string} [params.scannedBarcode] - Clean barcode to verify
 * @param {string} [params.barcode] - Alternative barcode field
 * @param {string} [params.sessionId] - Optional shopping/cart session ID
 * @returns {Promise<Object>} The normalized AI verification response
 */
export const verifyProductWithAi = async ({
  imageBlob,
  scannedBarcode,
  barcode,
  sessionId,
}) => {
  const cleanBarcode = String(scannedBarcode || barcode || "").trim();

  if (imageBlob) {
    const formData = new FormData();
    formData.append("image", imageBlob, "camera_capture.jpg");

    if (cleanBarcode) {
      formData.append("scannedBarcode", cleanBarcode);
      formData.append("barcode", cleanBarcode);
    }

    if (sessionId && sessionId.trim()) {
      formData.append("sessionId", sessionId.trim());
    }

    return apiClient("/camera/ai-verify", {
      method: "POST",
      body: formData,
    });
  }

  // Barcode-only verification request
  return apiClient("/camera/ai-verify", {
    method: "POST",
    body: JSON.stringify({
      barcode: cleanBarcode,
      scannedBarcode: cleanBarcode,
      sessionId: sessionId ? sessionId.trim() : undefined,
    }),
  });
};

/**
 * Checks whether the AI verification service is available.
 *
 * @returns {Promise<Object>}
 */
export const checkAiHealth = async () => {
  return apiClient("/camera/ai-health");
};
