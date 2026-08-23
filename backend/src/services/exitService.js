import crypto from "crypto";
import Cart from "../models/Cart.js";
import ExitToken from "../models/ExitToken.js";

const EXIT_TOKEN_EXPIRY_MINUTES = 5;

/**
 * Generate a cryptographically secure random token.
 */
const createRawExitToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Hash the token before storing it in MongoDB.
 *
 * The actual token is returned to the customer,
 * but only the hash is stored in the database.
 */
const hashToken = (token) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};

/**
 * Generate an exit QR token for a paid cart.
 */
export const generateExitToken = async (sessionId) => {
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

  /*
   * Only a successfully paid cart can generate
   * an exit QR.
   */
  if (cart.status !== "PAID") {
    const error = new Error(
      `Exit QR cannot be generated while cart status is ${cart.status}`
    );

    error.statusCode = 409;
    throw error;
  }

  /*
   * Invalidate any previous unused tokens for this cart.
   *
   * This prevents multiple valid exit QR codes from
   * existing simultaneously.
   */
  await ExitToken.updateMany(
    {
      sessionId,
      isUsed: false,
    },
    {
      $set: {
        isUsed: true,
        usedAt: new Date(),
      },
    }
  );

  const rawToken = createRawExitToken();
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date(
    Date.now() +
      EXIT_TOKEN_EXPIRY_MINUTES * 60 * 1000
  );

  await ExitToken.create({
    tokenHash,
    sessionId,
    expiresAt,
    isUsed: false,
  });

  return {
    token: rawToken,
    expiresAt,
    expiresInSeconds:
      EXIT_TOKEN_EXPIRY_MINUTES * 60,
  };
};

/**
 * Validate an exit QR token and complete the cart.
 */
export const validateExitToken = async (token) => {
  if (!token || typeof token !== "string") {
    const error = new Error("Exit token is required");
    error.statusCode = 400;
    throw error;
  }

  const tokenHash = hashToken(token);

  const exitToken = await ExitToken.findOne({
    tokenHash,
  });

  if (!exitToken) {
    const error = new Error("Invalid exit QR");
    error.statusCode = 401;
    throw error;
  }

  /*
   * Prevent QR replay.
   */
  if (exitToken.isUsed) {
    const error = new Error(
      "Exit QR has already been used"
    );
    error.statusCode = 409;
    throw error;
  }

  /*
   * Prevent expired QR codes from opening the gate.
   */
  if (exitToken.expiresAt <= new Date()) {
    const error = new Error("Exit QR has expired");
    error.statusCode = 410;
    throw error;
  }

  const cart = await Cart.findOne({
    sessionId: exitToken.sessionId,
  });

  if (!cart) {
    const error = new Error("Associated cart not found");
    error.statusCode = 404;
    throw error;
  }

  if (cart.status !== "PAID") {
    const error = new Error(
      `Cart cannot exit while status is ${cart.status}`
    );
    error.statusCode = 409;
    throw error;
  }

  /*
   * Mark token as used BEFORE completing the cart.
   *
   * This is important for preventing the same QR
   * from being processed twice.
   */
  exitToken.isUsed = true;
  exitToken.usedAt = new Date();

  await exitToken.save();

  cart.status = "COMPLETED";

  await cart.save();

  return {
    success: true,
    sessionId: cart.sessionId,
    status: cart.status,
    gateAccess: true,
  };
};