import {
  authenticateWithGoogle,
} from "../services/authService.js";

export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    const result =
      await authenticateWithGoogle(credential);

    return res.status(200).json({
      success: true,
      message: "Google authentication successful",
      data: result,
    });
  } catch (error) {
    console.error(
      "Google authentication error:",
      error
    );

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Google authentication failed",
    });
  }
};