import { getApiUrl } from "./client";

const API_URL = getApiUrl();

const getSessionId = () => {
  const sessionId = localStorage.getItem("sessionId");

  if (!sessionId) {
    throw new Error("No active shopping session found.");
  }

  return sessionId;
};

export const getCart = async () => {
  const sessionId = getSessionId();

  const response = await fetch(
    `${API_URL}/carts/${sessionId}`
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Failed to load cart"
    );
  }

  return data.data;
};

export const addProductToCart = async (barcodeOrProduct, quantity = 1) => {
  const sessionId = getSessionId();

  const bodyPayload =
    typeof barcodeOrProduct === "object" && barcodeOrProduct !== null
      ? {
          productId: barcodeOrProduct.productId || barcodeOrProduct.id || undefined,
          barcode: barcodeOrProduct.barcode,
          name: barcodeOrProduct.name,
          price: barcodeOrProduct.price,
          weight: barcodeOrProduct.weight,
          quantity: barcodeOrProduct.quantity || quantity,
        }
      : { barcode: barcodeOrProduct, quantity };

  const response = await fetch(
    `${API_URL}/carts/${sessionId}/items`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Failed to add product"
    );
  }

  return data.data;
};

export const removeProductFromCart = async (barcode) => {
  const sessionId = getSessionId();

  const response = await fetch(
    `${API_URL}/carts/${sessionId}/items/${encodeURIComponent(
      barcode
    )}`,
    {
      method: "DELETE",
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Failed to remove product"
    );
  }

  return data.data;
};

export const startCheckout = async () => {
  const sessionId = getSessionId();

  const response = await fetch(
    `${API_URL}/carts/${sessionId}/checkout`,
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
      data.message || "Failed to start checkout"
    );
  }

  return data.data;
};