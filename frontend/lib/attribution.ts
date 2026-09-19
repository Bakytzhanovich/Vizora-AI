/** First-touch traffic attribution.
 *
 * Stored in localStorage (same place as the language/theme prefs) and written
 * exactly once per browser — a later visit without UTM params must NOT
 * overwrite it, otherwise someone who first arrives from TikTok and then
 * returns by typing the address directly would be miscounted as "direct".
 *
 * IMPORTANT — why a lot of social traffic still lands in "direct":
 * clicks from the TikTok and Instagram in-app browsers usually send no
 * document.referrer at all, so the referrer fallback below cannot see them.
 * For those channels the ONLY reliable signal is a UTM tag on the link you
 * publish. Posting a bare link means that traffic is attributed as direct —
 * that's a property of the platforms, not a bug here.
 */

// A type alias, not an interface: only aliases get an implicit index
// signature, which is what lets this be passed straight to track() as event
// properties (Record<string, unknown>).
export type Attribution = {
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
};

const STORAGE_KEY = "vizora_first_touch";

const REFERRER_SOURCES: Array<[RegExp, string]> = [
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(t\.me|telegram\.org|telegram\.me)$/, "telegram"],
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)(facebook\.com|fb\.com)$/, "facebook"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)google\./, "google"],
  [/(^|\.)(yandex\.|ya\.ru)$/, "yandex"],
  [/(^|\.)mail\.ru$/, "mail.ru"],
];

function sourceFromReferrer(referrer: string): string | null {
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host === window.location.hostname) return null; // internal navigation
    for (const [pattern, name] of REFERRER_SOURCES) {
      if (pattern.test(host)) return name;
    }
    return host;
  } catch {
    return null;
  }
}

function detect(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source");

  if (utmSource) {
    return {
      source: utmSource.toLowerCase(),
      medium: (params.get("utm_medium") ?? "unknown").toLowerCase(),
      campaign: params.get("utm_campaign") ?? undefined,
      content: params.get("utm_content") ?? undefined,
    };
  }

  const referrerSource = document.referrer ? sourceFromReferrer(document.referrer) : null;
  if (referrerSource) {
    return { source: referrerSource, medium: "referral" };
  }

  return { source: "direct", medium: "none" };
}

/** Called on every route change, but only ever writes on the first one that
 * finds nothing stored. Safe to call repeatedly. */
export function captureFirstTouch(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(detect()));
  } catch {
    // Storage disabled (private mode, locked-down WebView) — attribution is
    // best-effort and must never break page rendering.
  }
}

export function getFirstTouch(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}
