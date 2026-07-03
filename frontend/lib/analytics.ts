const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface TrackPayload {
  event: string;
  properties?: Record<string, unknown>;
  url?: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function track(event: string, properties?: Record<string, unknown>): void {
  const payload: TrackPayload = {
    event,
    properties,
    url: typeof window !== "undefined" ? window.location.pathname : undefined,
  };

  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Single endpoint handles both anon and authenticated users.
  // Backend extracts user_id from token if valid; returns 204 regardless.
  fetch(`${BASE}/api/analytics/track`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  }).catch(() => {});
}
