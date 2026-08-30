import apiClient from "./client";

export const generateEntranceQR = async () => {
  return apiClient("/entrance/generate", {
    method: "POST",
  });
};

export const scanEntranceQR = async (qrToken) => {
  return apiClient("/entrance/scan", {
    method: "POST",
    body: JSON.stringify({
      qrToken,
    }),
  });
};