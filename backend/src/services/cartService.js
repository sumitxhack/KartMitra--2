import crypto from "crypto";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import { toGrams } from "../utils/weight.js";

const generateSessionId = () => {
  return crypto.randomUUID();
};

const calculateCartTotals = (items) => {
  let totalAmount = 0;
  let expectedWeight = 0;

  for (const item of items) {
    totalAmount += Number(item.totalPrice) || 0;
    expectedWeight += Number(item.totalWeight) || 0;
  }

  return {
    totalAmount: Number(totalAmount.toFixed(2)),
    expectedWeight,
  };
};

/*
 * ============================================================
 * CREATE CART
 * ============================================================
 *
 * IMPORTANT:
 * This function is used by the Entry QR flow.
 *
 * Product scanning MUST NOT call this function.
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
 */
export const getCartBySessionId = async (sessionId) => {
  if (!sessionId || typeof sessionId !== "string") {
    const error = new Error("Session ID is required");
    error.statusCode = 400;
    throw error;
  }

  const cart = await Cart.findOne({
    sessionId: sessionId.trim(),
  }).populate("items.product");

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
 * quantity is the quantity selected on Product Details page.
 *
 * Example:
 *
 * addProductToCart(
 *   sessionId,
 *   "8901234567890",
 *   3
 * );
 *
 * This adds THREE units in one request.
 *
 * IMPORTANT:
 * This function NEVER creates a cart.
 * The session must already exist from Entry QR validation.
 */
export const addProductToCart = async (
  sessionId,
  barcode,
  quantity = 1
) => {
  if (!sessionId || typeof sessionId !== "string") {
    const error = new Error("Session ID is required");
    error.statusCode = 400;
    throw error;
  }

  if (!barcode || typeof barcode !== "string") {
    const error = new Error("Product barcode is required");
    error.statusCode = 400;
    throw error;
  }

  const numericQuantity = Number(quantity);

  if (
    !Number.isInteger(numericQuantity) ||
    numericQuantity < 1
  ) {
    const error = new Error(
      "Quantity must be a positive whole number"
    );
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

  const product = await Product.findOne({
    barcode: barcode.trim(),
    isActive: true,
  });

  if (!product) {
    const error = new Error(
      "Product not found or inactive"
    );

    error.statusCode = 404;
    throw error;
  }

  let productWeight;

  try {
    productWeight = toGrams(
      product.weight,
      product.weightUnit
    );
  } catch (error) {
    error.statusCode = 422;
    throw error;
  }

  const existingItem = cart.items.find(
    (item) =>
      item.product.toString() === product._id.toString()
  );

  if (existingItem) {
    existingItem.quantity += numericQuantity;

    existingItem.totalPrice = Number(
      (
        existingItem.quantity *
        existingItem.unitPrice
      ).toFixed(2)
    );

    existingItem.totalWeight =
      existingItem.quantity *
      existingItem.unitWeight;
  } else {
    cart.items.push({
      product: product._id,
      name: product.name,
      barcode: product.barcode,
      quantity: numericQuantity,
      unitPrice: product.price,
      unitWeight: productWeight,
      totalPrice: Number(
        (product.price * numericQuantity).toFixed(2)
      ),
      totalWeight:
        productWeight * numericQuantity,
    });
  }

  const totals = calculateCartTotals(cart.items);

  cart.totalAmount = totals.totalAmount;
  cart.expectedWeight = totals.expectedWeight;

  await cart.save();

  return cart;
};

/*
 * ============================================================
 * REMOVE ONE PRODUCT QUANTITY
 * ============================================================
 *
 * If quantity is greater than 1:
 *     quantity decreases by 1
 *
 * If quantity is 1:
 *     product is removed completely
 */
export const removeProductFromCart = async (
  sessionId,
  barcode
) => {
  if (!sessionId || typeof sessionId !== "string") {
    const error = new Error("Session ID is required");
    error.statusCode = 400;
    throw error;
  }

  if (!barcode || typeof barcode !== "string") {
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

  const itemIndex = cart.items.findIndex(
    (item) =>
      item.barcode === barcode.trim()
  );

  if (itemIndex === -1) {
    const error = new Error(
      "Product is not in the cart"
    );

    error.statusCode = 404;
    throw error;
  }

  const item = cart.items[itemIndex];

  if (item.quantity > 1) {
    item.quantity -= 1;

    item.totalPrice = Number(
      (
        item.quantity *
        item.unitPrice
      ).toFixed(2)
    );

    item.totalWeight =
      item.quantity *
      item.unitWeight;
  } else {
    cart.items.splice(itemIndex, 1);
  }

  const totals = calculateCartTotals(cart.items);

  cart.totalAmount = totals.totalAmount;
  cart.expectedWeight = totals.expectedWeight;

  await cart.save();

  return cart;
};