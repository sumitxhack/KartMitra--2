const API_URL = "http://localhost:5000/api";

export const googleLogin = async (credential) => {
  const response = await fetch(`${API_URL}/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      credential,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Google authentication failed"
    );
  }

  return data;
};