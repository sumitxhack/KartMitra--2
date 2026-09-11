export const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof window !== "undefined") {
    const currentHost = window.location.hostname;
    // When accessed from mobile or remote browser using LAN IP (e.g. 192.168.x.x, 10.x.x.x)
    if (currentHost && currentHost !== "localhost" && currentHost !== "127.0.0.1") {
      // If envUrl is missing, or is configured for localhost or an old hardcoded IP, use currentHost
      if (!envUrl || envUrl.includes("localhost") || envUrl.includes("127.0.0.1") || !envUrl.includes(currentHost)) {
        return `http://${currentHost}:5000/api`;
      }
    } else if (currentHost === "localhost" || currentHost === "127.0.0.1") {
      if (!envUrl || (!envUrl.includes("localhost") && !envUrl.includes("127.0.0.1"))) {
        return "http://localhost:5000/api";
      }
    }
  }
  return envUrl || "http://localhost:5000/api";
};

export const API_URL = getApiUrl();

const apiClient = async (endpoint, options = {}) => {
  const baseUrl = getApiUrl();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
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