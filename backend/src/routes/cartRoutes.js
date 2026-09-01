import express from "express";

import {
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
 * ============================================================
 * GET /api/carts/:sessionId
 * ============================================================
 *
 * Get the customer's current cart using the session ID
 *
 * Example:
 * GET /api/carts/550e8400-e29b-41d4-a716-446655440000
 */
router.get("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

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
 * ============================================================
 * POST /api/carts/:sessionId/items
 * ============================================================
 *
 * Add one product quantity to the customer's cart.
 *
 * Body:
 * {
 *   "barcode": "8901234567890"
 * }
 *
 * The session MUST already exist.
 *
 * A cart is NOT created here.
 */
router.post("/:sessionId/items", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { barcode } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    if (!barcode || typeof barcode !== "string") {
      return res.status(400).json({
        success: false,
        message: "Barcode is required",
      });
    }

    const cart = await addProductToCart(
      sessionId,
      barcode.trim()
    );

    return res.status(200).json({
      success: true,
      message: "Product added to cart",
      data: cart,
    });
  } catch (error) {
    console.error(
      "Add product to cart error:",
      error
    );

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || "Failed to add product",
    });
  }
});

/**
 * ============================================================
 * DELETE /api/carts/:sessionId/items/:barcode
 * ============================================================
 *
 * Remove ONE quantity of a product from the cart.
 *
 * If quantity is greater than 1:
 *     quantity decreases by 1
 *
 * If quantity is 1:
 *     product is removed completely
 */
router.delete(
  "/:sessionId/items/:barcode",
  async (req, res) => {
    try {
      const { sessionId, barcode } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "Session ID is required",
        });
      }

      if (!barcode) {
        return res.status(400).json({
          success: false,
          message: "Barcode is required",
        });
      }

      const cart = await removeProductFromCart(
        sessionId,
        barcode.trim()
      );

      return res.status(200).json({
        success: true,
        message: "Product removed from cart",
        data: cart,
      });
    } catch (error) {
      console.error(
        "Remove product from cart error:",
        error
      );

      return res.status(error.statusCode || 500).json({
        success: false,
        message:
          error.message ||
          "Failed to remove product",
      });
    }
  }
);

/**
 * ============================================================
 * POST /api/carts/:sessionId/checkout
 * ============================================================
 *
 * Start checkout for the current shopping session.
 *
 * No new cart is created here.
 */
router.post(
  "/:sessionId/checkout",
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "Session ID is required",
        });
      }

      const result = await startCheckout(sessionId);

      return res.status(200).json({
        success: true,
        message: result.requiresVerification
          ? "Verification required before payment"
          : "Checkout started. Waiting for weight verification",
        data: result,
      });
    } catch (error) {
      console.error(
        "Start checkout error:",
        error
      );

      return res.status(error.statusCode || 500).json({
        success: false,
        message:
          error.message ||
          "Failed to start checkout",
      });
    }
  }
);

/**
 * ============================================================
 * POST /api/carts/:sessionId/weight
 * ============================================================
 *
 * Verify the physical cart weight.
 *
 * Body:
 * {
 *   "actualWeight": 1000
 * }
 *
 * Weight must be supplied in grams.
 */
router.post(
  "/:sessionId/weight",
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { actualWeight } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "Session ID is required",
        });
      }

      if (
        actualWeight === undefined ||
        actualWeight === null
      ) {
        return res.status(400).json({
          success: false,
          message: "Actual weight is required",
        });
      }

      const numericWeight = Number(actualWeight);

      if (
        !Number.isFinite(numericWeight) ||
        numericWeight < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Actual weight must be a valid non-negative number",
        });
      }

      const result = await verifyCartWeight(
        sessionId,
        numericWeight
      );

      return res.status(200).json({
        success: true,
        message: result.canPay
          ? "Weight verified. Payment can proceed."
          : "Weight verification failed. Staff verification required.",
        data: result,
      });
    } catch (error) {
      console.error(
        "Weight verification error:",
        error
      );

      return res.status(error.statusCode || 500).json({
        success: false,
        message:
          error.message ||
          "Failed to verify cart weight",
      });
    }
  }
);

export default router;