const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface TrackPayload {
  event: string;
  properties?: Record<string, unknown>;
  url?: string;
  session_id?: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

// Not cryptographically sensitive — just needs to be unlikely to collide
// with another tab's id — so a Math.random fallback is fine for browsers/
// WebViews (e.g. older Telegram in-app browsers) without crypto.randomUUID.
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// One id per browser tab (sessionStorage, not localStorage) — this is what
// lets admin analytics group page_view events into visits and compute
// entry/exit pages. A fresh tab (or a tab reopened after being closed)
// gets a new id, which is the usual definition of "one visit".
function getSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const KEY = "va_session_id";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = generateId();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  // Analytics must never break the caller's control flow — several call
  // sites invoke track() as the first statement before/inside a try block
  // guarding a real network request, so any synchronous throw here (e.g.
  // sessionStorage disabled in a locked-down WebView) would otherwise
  // either skip that request entirely or leave the UI stuck mid-flow.
  try {
    const payload: TrackPayload = {
      event,
      properties,
      url: typeof window !== "undefined" ? window.location.pathname : undefined,
      session_id: getSessionId(),
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
  } catch {
    // Best-effort telemetry — swallow and move on.
  }
}
