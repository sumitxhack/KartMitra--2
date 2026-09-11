// Admin authentication helper utilities
// Reuses the session key and contract from KartMitra AI Verification Lab

export const ADMIN_AUTH_STORAGE_KEY = "kartmitra_admin_auth";

/**
 * Get current admin session from localStorage
 */
export const getAdminAuth = () => {
  try {
    const stored = localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed && parsed.authenticated === true) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.error("Error reading admin auth session:", err);
    return null;
  }
};

/**
 * Check whether admin is authenticated
 */
export const isAdminAuthenticated = () => {
  const auth = getAdminAuth();
  return Boolean(auth && auth.authenticated);
};

/**
 * Store admin session in localStorage
 */
export const setAdminAuth = ({ email, name, role } = {}) => {
  const session = {
    authenticated: true,
    email: email || "admin@kartmitra.com",
    name: name || "Store Manager",
    role: role || "Administrator",
    loginTime: new Date().toISOString(),
  };
  localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
};

/**
 * Clear admin session from localStorage
 */
export const clearAdminAuth = () => {
  localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
};

/**
 * Verify admin credentials without hardcoding sensitive secrets.
 * Reads environment variables with safe defaults for prototyping.
 */
export const verifyAdminCredentials = (inputEmail, inputPassword) => {
  const email = (inputEmail || "").trim().toLowerCase();
  const password = inputPassword || "";

  // Environment variables or prototype defaults
  const expectedEmail = (
    (typeof import.meta !== "undefined" && import.meta?.env?.VITE_ADMIN_EMAIL) ||
    "admin@kartmitra.com"
  ).trim().toLowerCase();

  const expectedPassword =
    (typeof import.meta !== "undefined" && import.meta?.env?.VITE_ADMIN_PASSWORD) ||
    "admin123";

  // Check email/password match
  const matchesEmail =
    email === expectedEmail || email === "admin";
  const matchesPassword = password === expectedPassword;

  if (matchesEmail && matchesPassword) {
    return {
      success: true,
      user: {
        email: expectedEmail,
        name: "Store Manager",
        role: "Administrator",
      },
    };
  }

  return {
    success: false,
    message: "Invalid email or password. Please try again.",
  };
};
