import { getApiUrl } from "./client";

/**
 * Generate the entrance QR.
 *
 * Used by the store/display screen.
 */
export const generateEntranceQR = async () => {
  const baseUrl = getApiUrl();
  const response = await fetch(
    `${baseUrl}/entrance/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Failed to generate entrance QR"
    );
  }

  return data;
};


/**
 * Scan/validate the entrance QR.
 *
 * Backend:
 * POST /api/entrance/scan
 *
 * Returns a newly created shopping session.
 */
export const scanEntranceQR = async (qrToken) => {
  if (!qrToken || typeof qrToken !== "string") {
    throw new Error("QR token is required");
  }

  const baseUrl = getApiUrl();
  const response = await fetch(
    `${baseUrl}/entrance/scan`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        qrToken,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Unable to start shopping session"
    );
  }

  return data;
};