import Cart from "../models/Cart.js";

const getWeightTolerance = () => {
  const tolerance = Number(
    process.env.WEIGHT_TOLERANCE_GRAMS || 20
  );

  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return 20;
  }

  return tolerance;
};

/**
 * Start checkout for a cart.
 *
 * Flow:
 * ACTIVE
 *   ↓
 * CHECKOUT_PENDING
 *
 * If a camera mismatch already exists:
 * ACTIVE
 *   ↓
 * VERIFICATION_REQUIRED
 */
export const startCheckout = async (sessionId) => {
  if (!sessionId || typeof sessionId !== "string") {
    const error = new Error("Session ID is required");
    error.statusCode = 400;
    throw error;
  }

  const cart = await Cart.findOne({ sessionId });

  if (!cart) {
    const error = new Error("Cart not found");
    error.statusCode = 404;
    throw error;
  }

  if (cart.items.length === 0) {
    const error = new Error("Cannot checkout an empty cart");
    error.statusCode = 400;
    throw error;
  }

 if (
  !["ACTIVE", "CHECKOUT_PENDING", "VERIFICATION_REQUIRED"].includes(
    cart.status
  )
) {
    const error = new Error(
      `Checkout cannot be started while cart status is ${cart.status}`
    );

    error.statusCode = 409;
    throw error;
  }

  /*
   * If the camera has already detected a mismatch,
   * do not allow the cart to proceed directly to payment.
   */
  if (cart.hasMismatch) {
    cart.status = "VERIFICATION_REQUIRED";

    await cart.save();

    return {
      cart,
      requiresVerification: true,
      requiresWeightVerification: false,
      canPay: false,
    };
  }

  /*
   * Clear previous weight verification state.
   * This is important if checkout is retried.
   */
  cart.actualWeight = null;
  cart.weightDifference = null;
  cart.weightVerified = false;

  cart.status = "CHECKOUT_PENDING";

  await cart.save();

  return {
    cart,
    requiresVerification: false,
    requiresWeightVerification: true,
    canPay: false,
  };
};

/**
 * Verify the physical cart weight reported by
 * the load-cell/sensor system.
 *
 * Expected weight is always stored in grams.
 * The sensor must therefore send actualWeight in grams.
 */
export const verifyCartWeight = async (
  sessionId,
  actualWeight
) => {
  if (!sessionId || typeof sessionId !== "string") {
    const error = new Error("Session ID is required");
    error.statusCode = 400;
    throw error;
  }

  const numericWeight = Number(actualWeight);

  if (
    actualWeight === undefined ||
    actualWeight === null ||
    actualWeight === "" ||
    !Number.isFinite(numericWeight) ||
    numericWeight < 0
  ) {
    const error = new Error(
      "Actual weight must be a valid non-negative number in grams"
    );

    error.statusCode = 400;
    throw error;
  }

  const cart = await Cart.findOne({ sessionId });

  if (!cart) {
    const error = new Error("Cart not found");
    error.statusCode = 404;
    throw error;
  }

  if (cart.items.length === 0) {
    const error = new Error(
      "Cannot verify weight for an empty cart"
    );

    error.statusCode = 400;
    throw error;
  }

  if (cart.status !== "CHECKOUT_PENDING") {
    const error = new Error(
      `Weight verification is not allowed while cart status is ${cart.status}`
    );

    error.statusCode = 409;
    throw error;
  }

  const expectedWeight = Number(cart.expectedWeight);
  const difference = Math.abs(
    numericWeight - expectedWeight
  );

  const tolerance = getWeightTolerance();

  const weightVerified = difference <= tolerance;

  cart.actualWeight = numericWeight;
  cart.weightDifference = Number(difference.toFixed(2));
  cart.weightVerified = weightVerified;

  /*
   * Weight must match AND there must be no camera mismatch
   * before payment can proceed.
   */
  if (weightVerified && !cart.hasMismatch) {
    cart.status = "PAYMENT_PENDING";
  } else {
    cart.status = "VERIFICATION_REQUIRED";
  }

  await cart.save();

  return {
    cart,
    expectedWeight,
    actualWeight: numericWeight,
    weightDifference: Number(difference.toFixed(2)),
    tolerance,
    weightVerified,
    requiresVerification: !weightVerified || cart.hasMismatch,
    canPay:
      weightVerified &&
      !cart.hasMismatch &&
      cart.status === "PAYMENT_PENDING",
  };
};