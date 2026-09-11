import crypto from "crypto";
import Cart from "../models/Cart.js";

const DEFAULT_AI_URL = "http://localhost:8000";

const generateSessionId = () => {
  return crypto.randomUUID();
};

/**
 * Calculate cart-level totals from items array.
 * @param {Array} items
 * @returns {{ totalAmount: number, expectedWeight: number }}
 */
export const calculateCartTotals = (items = []) => {
  let totalAmount = 0;
  let expectedWeight = 0;

  for (const item of items) {
    totalAmount += Number(item.totalPrice) || 0;
    expectedWeight += Number(item.totalWeight) || 0;
  }

  return {
    totalAmount: Number(totalAmount.toFixed(2)),
    expectedWeight: Number(expectedWeight.toFixed(2)),
  };
};

/**
 * Fetch product details from the authoritative AI Verification Lab PostgreSQL database.
 * @param {string} barcode
 * @returns {Promise<Object|null>}
 */
export const fetchAiLabProduct = async (barcode) => {
  if (!barcode || typeof barcode !== "string") return null;

  const baseUrl = process.env.AI_VERIFICATION_URL || DEFAULT_AI_URL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/products/barcode/${encodeURIComponent(barcode.trim())}`,
      {
        method: "GET",
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json().catch(() => null);
      const product = data?.product || data;
      if (product && (product.barcode || product.name)) {
        return product;
      }
    }
    return null;
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
};

/*
 * ============================================================
 * CREATE CART
 * ============================================================
 *
 * IMPORTANT:
 * Used exclusively by the Entry QR flow.
 */
export const createCart = async () => {
  const sessionId = generateSessionId();

  const cart = await Cart.create({
    sessionId,
    items: [],
    totalAmount: 0,
    expectedWeight: 0,
    status: "ACTIVE",
  });

  return cart;
};

/*
 * ============================================================
 * GET CART
 * ============================================================
 * Note: No longer populates MongoDB Product document.
 */
export const getCartBySessionId = async (sessionId) => {
  if (!sessionId || typeof sessionId !== "string" || !sessionId.trim()) {
    const error = new Error("Session ID is required");
    error.statusCode = 400;
    throw error;
  }

  const cart = await Cart.findOne({
    sessionId: sessionId.trim(),
  });

  if (!cart) {
    const error = new Error("Cart not found");
    error.statusCode = 404;
    throw error;
  }

  return cart;
};

/*
 * ============================================================
 * ADD PRODUCT TO CART
 * ============================================================
 *
 * Accepts either:
 *   addProductToCart(sessionId, barcode, quantity)
 *   addProductToCart(sessionId, { productId, barcode, name, price, weight, quantity }, quantity)
 *
 * Authoritative flow:
 * 1. Validates sessionId, barcode, quantity.
 * 2. Checks AI Verification Lab PostgreSQL database for authoritative product data.
 *    - Uses authoritative price and weight from AI Lab to prevent price tampering.
 * 3. If AI Lab is unreachable or in test environment, validates the supplied
 *    verified product snapshot fields (name, price, weight).
 * 4. Increments quantity if barcode already exists in cart, or pushes new snapshot item.
 * 5. Calculates totalPrice, totalWeight, cart totalAmount, and expectedWeight.
 * 6. Completely eliminates dependency on MongoDB Product documents.
 */
export const addProductToCart = async (
  sessionId,
  barcodeOrProduct,
  quantity = 1
) => {
  // 1. Validate Session ID
  if (!sessionId || typeof sessionId !== "string" || !sessionId.trim()) {
    const error = new Error("Session ID is required");
    error.statusCode = 400;
    throw error;
  }

  // 2. Parse input parameters
  let inputBarcode = null;
  let inputProductId = null;
  let inputName = null;
  let inputPrice = undefined;
  let inputWeight = undefined;
  let numericQuantity = 1;

  if (barcodeOrProduct && typeof barcodeOrProduct === "object") {
    inputBarcode = barcodeOrProduct.barcode;
    inputProductId = barcodeOrProduct.productId || barcodeOrProduct.id || null;
    inputName = barcodeOrProduct.name;
    inputPrice =
      barcodeOrProduct.price !== undefined
        ? barcodeOrProduct.price
        : barcodeOrProduct.unitPrice;
    inputWeight =
      barcodeOrProduct.weight !== undefined
        ? barcodeOrProduct.weight
        : barcodeOrProduct.unitWeight;

    if (barcodeOrProduct.quantity !== undefined) {
      numericQuantity = Number(barcodeOrProduct.quantity);
    } else {
      numericQuantity = Number(quantity ?? 1);
    }
  } else {
    inputBarcode = barcodeOrProduct;
    numericQuantity = Number(quantity ?? 1);
  }

  // 3. Validate Barcode
  if (!inputBarcode || typeof inputBarcode !== "string" || !inputBarcode.trim()) {
    const error = new Error("Product barcode is required");
    error.statusCode = 400;
    throw error;
  }

  const cleanBarcode = inputBarcode.trim();

  // 4. Validate Quantity
  if (!Number.isInteger(numericQuantity) || numericQuantity < 1) {
    const error = new Error("Quantity must be a positive whole number");
    error.statusCode = 400;
    throw error;
  }

  // 5. Verify Cart existence and active status
  const cart = await Cart.findOne({
    sessionId: sessionId.trim(),
  });

  if (!cart) {
    const error = new Error("Cart not found");
    error.statusCode = 404;
    throw error;
  }

  if (cart.status !== "ACTIVE") {
    const error = new Error(
      `Cannot modify cart while status is ${cart.status}`
    );
    error.statusCode = 409;
    throw error;
  }

  // 6. Authoritative Product Resolution
  // Query AI Verification Lab PostgreSQL database
  const aiLabProduct = await fetchAiLabProduct(cleanBarcode);

  let resolvedProductId = null;
  let resolvedName = null;
  let resolvedPrice = null;
  let resolvedWeight = null;

  if (aiLabProduct) {
    // Authoritative data from AI Lab PostgreSQL
    resolvedProductId = aiLabProduct.id ? String(aiLabProduct.id) : (inputProductId ? String(inputProductId) : null);
    resolvedName = aiLabProduct.name || inputName;
    resolvedPrice = Number(aiLabProduct.price);

    // AI Lab weights are in kg if <= 20 (e.g. 1.0 kg for 1000g), or grams if > 20
    const rawWeight = Number(aiLabProduct.weight);
    if (Number.isFinite(rawWeight) && rawWeight > 0) {
      resolvedWeight = rawWeight <= 20 ? rawWeight * 1000 : rawWeight;
    } else if (inputWeight !== undefined && Number.isFinite(Number(inputWeight)) && Number(inputWeight) >= 0) {
      resolvedWeight = Number(inputWeight);
    } else {
      resolvedWeight = 0;
    }
  } else {
    // Validate supplied product data (verified backend flow or test environment)
    if (!inputName || typeof inputName !== "string" || !inputName.trim()) {
      const error = new Error("Product name is required");
      error.statusCode = 400;
      throw error;
    }

    if (
      inputPrice === undefined ||
      inputPrice === null ||
      !Number.isFinite(Number(inputPrice)) ||
      Number(inputPrice) < 0
    ) {
      const error = new Error("Valid product price is required");
      error.statusCode = 400;
      throw error;
    }

    if (
      inputWeight === undefined ||
      inputWeight === null ||
      !Number.isFinite(Number(inputWeight)) ||
      Number(inputWeight) < 0
    ) {
      const error = new Error("Valid product weight is required");
      error.statusCode = 400;
      throw error;
    }

    resolvedProductId = inputProductId ? String(inputProductId) : null;
    resolvedName = inputName.trim();
    resolvedPrice = Number(inputPrice);
    resolvedWeight = Number(inputWeight);
  }

  // Final sanity checks on price and weight
  if (!Number.isFinite(resolvedPrice) || resolvedPrice < 0) {
    const error = new Error("Valid product price is required");
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(resolvedWeight) || resolvedWeight < 0) {
    const error = new Error("Valid product weight is required");
    error.statusCode = 400;
    throw error;
  }

  // 7. Insert or update snapshot item in cart
  const existingItemIndex = cart.items.findIndex(
    (item) => item.barcode === cleanBarcode
  );

  if (existingItemIndex !== -1) {
    const existingItem = cart.items[existingItemIndex];
    existingItem.quantity += numericQuantity;
    existingItem.totalPrice = Number(
      (existingItem.quantity * existingItem.unitPrice).toFixed(2)
    );
    existingItem.totalWeight = Number(
      (existingItem.quantity * existingItem.unitWeight).toFixed(2)
    );
  } else {
    const unitPrice = Number(resolvedPrice.toFixed(2));
    const unitWeight = Number(resolvedWeight.toFixed(2));
    const totalPrice = Number((unitPrice * numericQuantity).toFixed(2));
    const totalWeight = Number((unitWeight * numericQuantity).toFixed(2));

    cart.items.push({
      productId: resolvedProductId,
      product: resolvedProductId || cleanBarcode,
      name: resolvedName,
      barcode: cleanBarcode,
      quantity: numericQuantity,
      unitPrice,
      unitWeight,
      totalPrice,
      totalWeight,
    });
  }

  // 8. Calculate and update cart totals
  const totals = calculateCartTotals(cart.items);
  cart.totalAmount = totals.totalAmount;
  cart.expectedWeight = totals.expectedWeight;

  await cart.save();
  return cart;
};

/*
 * ============================================================
 * REMOVE PRODUCT FROM CART
 * ============================================================
 *
 * Decrements quantity by 1 if > 1; splices item if quantity === 1.
 * Recalculates cart totals and weight.
 */
export const removeProductFromCart = async (sessionId, barcode) => {
  if (!sessionId || typeof sessionId !== "string" || !sessionId.trim()) {
    const error = new Error("Session ID is required");
    error.statusCode = 400;
    throw error;
  }

  if (!barcode || typeof barcode !== "string" || !barcode.trim()) {
    const error = new Error("Product barcode is required");
    error.statusCode = 400;
    throw error;
  }

  const cart = await Cart.findOne({
    sessionId: sessionId.trim(),
  });

  if (!cart) {
    const error = new Error("Cart not found");
    error.statusCode = 404;
    throw error;
  }

  if (cart.status !== "ACTIVE") {
    const error = new Error(
      `Cannot modify cart while status is ${cart.status}`
    );
    error.statusCode = 409;
    throw error;
  }

  const cleanBarcode = barcode.trim();
  const itemIndex = cart.items.findIndex(
    (item) => item.barcode === cleanBarcode
  );

  if (itemIndex === -1) {
    const error = new Error("Product is not in the cart");
    error.statusCode = 404;
    throw error;
  }

  const item = cart.items[itemIndex];

  if (item.quantity > 1) {
    item.quantity -= 1;
    item.totalPrice = Number(
      (item.quantity * item.unitPrice).toFixed(2)
    );
    item.totalWeight = Number(
      (item.quantity * item.unitWeight).toFixed(2)
    );
  } else {
    cart.items.splice(itemIndex, 1);
  }

  const totals = calculateCartTotals(cart.items);
  cart.totalAmount = totals.totalAmount;
  cart.expectedWeight = totals.expectedWeight;

  await cart.save();
  return cart;
};