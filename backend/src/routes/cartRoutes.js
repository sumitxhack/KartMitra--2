import express from "express";

import {
  createCart,
  getCartBySessionId,
  addProductToCart,
  removeProductFromCart,
} from "../services/cartService.js";

import {
  startCheckout,
  verifyCartWeight,
} from "../services/checkoutService.js";

const router = express.Router();



/**
 * GET /api/carts/:sessionId
 * Get the current cart.
 */
router.get("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const cart = await getCartBySessionId(sessionId);

    return res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    console.error("Get cart error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to get cart",
    });
  }
});

/**
 * POST /api/carts/:sessionId/items
 *
 * Body:
 * {
 *   "barcode": "8901234567890"
 * }
 */
router.post("/:sessionId/items", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { barcode } = req.body;

    if (!barcode || typeof barcode !== "string") {
      return res.status(400).json({
        success: false,
        message: "Barcode is required",
      });
    }

    const cart = await addProductToCart(sessionId, barcode);

    return res.status(200).json({
      success: true,
      message: "Product added to cart",
      data: cart,
    });
  } catch (error) {
    console.error("Add product to cart error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to add product",
    });
  }
});

/**
 * DELETE /api/carts/:sessionId/items/:barcode
 *
 * Removes one quantity of the product.
 */
router.delete(
  "/:sessionId/items/:barcode",
  async (req, res) => {
    try {
      const { sessionId, barcode } = req.params;

      const cart = await removeProductFromCart(
        sessionId,
        barcode
      );

      return res.status(200).json({
        success: true,
        message: "Product removed from cart",
        data: cart,
      });
    } catch (error) {
      console.error("Remove product from cart error:", error);

      return res.status(error.statusCode || 500).json({
        success: false,
        message:
          error.message || "Failed to remove product",
      });
    }
  }
);

/**
 * POST /api/carts/:sessionId/checkout
 *
 * Starts checkout and tells the frontend whether
 * weight verification or staff verification is required.
 */
router.post("/:sessionId/checkout", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await startCheckout(sessionId);

    return res.status(200).json({
      success: true,
      message: result.requiresVerification
        ? "Verification required before payment"
        : "Checkout started. Waiting for weight verification",
      data: result,
    });
  } catch (error) {
    console.error("Start checkout error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to start checkout",
    });
  }
});

/**
 * POST /api/carts/:sessionId/weight
 *
 * Receives the physical weight measured by the load sensor.
 *
 * Body:
 * {
 *   "actualWeight": 1000
 * }
 *
 * Weight must be supplied in grams.
 */
router.post("/:sessionId/weight", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { actualWeight } = req.body;

    const result = await verifyCartWeight(
      sessionId,
      actualWeight
    );

    return res.status(200).json({
      success: true,
      message: result.canPay
        ? "Weight verified. Payment can proceed."
        : "Weight verification failed. Staff verification required.",
      data: result,
    });
  } catch (error) {
    console.error("Weight verification error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || "Failed to verify cart weight",
    });
  }
});

export default router;