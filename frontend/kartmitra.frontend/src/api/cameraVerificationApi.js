import apiClient from "./client";

/**
 * Sends a captured image and optional barcode/session info to the AI verification endpoint.
 *
 * @param {Object} params
 * @param {Blob|File} params.imageBlob - The captured image Blob or File
 * @param {string} [params.scannedBarcode] - Optional barcode from scanner
 * @param {string} [params.sessionId] - Optional shopping/cart session ID
 * @returns {Promise<Object>} The normalized AI verification response
 */
export const verifyProductWithAi = async ({
  imageBlob,
  scannedBarcode,
  sessionId,
}) => {
  if (!imageBlob) {
    throw new Error("A camera image is required for AI verification.");
  }

  const formData = new FormData();
  formData.append("image", imageBlob, "camera_capture.jpg");

  if (scannedBarcode && scannedBarcode.trim()) {
    formData.append("scannedBarcode", scannedBarcode.trim());
  }

  if (sessionId && sessionId.trim()) {
    formData.append("sessionId", sessionId.trim());
  }

  return apiClient("/camera/ai-verify", {
    method: "POST",
    body: formData,
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
