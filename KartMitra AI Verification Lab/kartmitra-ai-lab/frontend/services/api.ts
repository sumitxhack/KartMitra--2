const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface HealthResponse {
  status: string;
  database: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch(`${API_URL}/health`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`Server returned ${res.status} status`);
    }
    return await res.json();
  } catch (error) {
    console.error("Health check fetch failed:", error);
    throw error;
  }
}
