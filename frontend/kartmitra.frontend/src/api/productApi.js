import apiClient from "./client";

export const getProductByBarcode = async (barcode) => {
  if (!barcode) {
    throw new Error("Product barcode is required");
  }

  return apiClient(
    `/products/barcode/${encodeURIComponent(barcode)}`
  );
};

export const getProducts = async () => {
  return apiClient("/products");
};

export const createProduct = async (productData) => {
  return apiClient("/products", {
    method: "POST",
    body: JSON.stringify(productData),
  });
};