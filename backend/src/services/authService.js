import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

import User from "../models/User.js";

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

// Verify Google credential and create/login user
export const authenticateWithGoogle = async (credential) => {
  if (!credential) {
    const error = new Error("Google credential is required");
    error.statusCode = 400;
    throw error;
  }

  // Verify the ID token received from Google
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    const error = new Error("Invalid Google credential");
    error.statusCode = 401;
    throw error;
  }

  const {
    sub: googleId,
    name,
    email,
    picture,
    email_verified: emailVerified,
  } = payload;

  if (!email || !emailVerified) {
    const error = new Error(
      "Google account email is not verified"
    );

    error.statusCode = 401;
    throw error;
  }

  // Find existing customer
  let user = await User.findOne({ googleId });

  // Create customer if this is their first login
  if (!user) {
    user = await User.create({
      googleId,
      name,
      email,
      picture: picture || "",
      role: "CUSTOMER",
      isActive: true,
    });
  }

  // Prevent disabled accounts from logging in
  if (!user.isActive) {
    const error = new Error("Your account has been disabled");
    error.statusCode = 403;
    throw error;
  }

  // Generate KartMitra JWT
  const token = jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );

  return {
    token,

    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      picture: user.picture,
      role: user.role,
    },
  };
};