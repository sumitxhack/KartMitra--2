import Cart from "../models/Cart.js";

export const processPayment = async (sessionId) => {
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

  if (cart.status !== "PAYMENT_PENDING") {
    const error = new Error(
      `Payment is not allowed while cart status is ${cart.status}`
    );
    error.statusCode = 409;
    throw error;
  }

  if (!cart.weightVerified) {
    const error = new Error("Cart weight has not been verified");
    error.statusCode = 409;
    throw error;
  }

  if (cart.hasMismatch) {
    const error = new Error(
      "Payment is not allowed because cart has a product mismatch"
    );
    error.statusCode = 409;
    throw error;
  }

  // Simulated payment for now.
  // Later this will be replaced with Razorpay/Stripe/etc.
  cart.status = "PAID";

  await cart.save();

  return {
    cart,
    paymentStatus: "PAID",
    amount: cart.totalAmount,
  };
};