import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

/**
 * Verify whether the product detected by the camera
 * matches the product expected in the shopping cart.
 */
export const verifyCameraProduct = async (
  sessionId,
  scannedBarcode,
  detectedBarcode
) => {
  if (!sessionId || typeof sessionId !== "string") {
    const error = new Error("Session ID is required");
    error.statusCode = 400;
    throw error;
  }

  if (!scannedBarcode || typeof scannedBarcode !== "string") {
    const error = new Error("Scanned barcode is required");
    error.statusCode = 400;
    throw error;
  }

  if (!detectedBarcode || typeof detectedBarcode !== "string") {
    const error = new Error("Detected barcode is required");
    error.statusCode = 400;
    throw error;
  }

  const cart = await Cart.findOne({ sessionId });

  if (!cart) {
    const error = new Error("Cart not found");
    error.statusCode = 404;
    throw error;
  }

  if (cart.status !== "ACTIVE") {
    const error = new Error(
      `Camera verification is not allowed while cart status is ${cart.status}`
    );
    error.statusCode = 409;
    throw error;
  }

  const scannedProduct = await Product.findOne({
    barcode: scannedBarcode.trim(),
    isActive: true,
  });

  if (!scannedProduct) {
    const error = new Error("Scanned product not found");
    error.statusCode = 404;
    throw error;
  }

  const detectedProduct = await Product.findOne({
    barcode: detectedBarcode.trim(),
    isActive: true,
  });

  if (!detectedProduct) {
    const error = new Error("Camera detected an unknown product");
    error.statusCode = 404;
    throw error;
  }

  const isMatch =
    scannedProduct._id.toString() ===
    detectedProduct._id.toString();

  if (!isMatch) {
    cart.hasMismatch = true;

    cart.mismatchDetails = {
      scannedProduct: scannedProduct._id,
      detectedProduct: detectedProduct._id,
      message: `Mismatch detected: expected ${scannedProduct.name}, but camera detected ${detectedProduct.name}`,
    };

    await cart.save();

    return {
      verified: false,
      hasMismatch: true,
      message: cart.mismatchDetails.message,
      scannedProduct: {
        id: scannedProduct._id,
        name: scannedProduct.name,
      },
      detectedProduct: {
        id: detectedProduct._id,
        name: detectedProduct.name,
      },
    };
  }

  return {
    verified: true,
    hasMismatch: false,
    message: "Product verified successfully",
    product: {
      id: scannedProduct._id,
      name: scannedProduct.name,
    },
  };
};