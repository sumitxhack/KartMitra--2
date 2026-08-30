const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("VITE_API_URL is not configured");
}

const apiClient = async (endpoint, options = {}) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Server returned an invalid response");
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || "Something went wrong"
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
};

export default apiClient;