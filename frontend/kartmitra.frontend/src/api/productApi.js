import apiClient from "./client";

export const getProductByBarcode = async (barcode) => {
  if (!barcode) {
    throw new Error("Product barcode is required");
  }

  return apiClient(
    `/products/barcode/${encodeURIComponent(barcode)}`
  );
};