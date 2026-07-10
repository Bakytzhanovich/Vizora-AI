/* eslint-disable @typescript-eslint/no-explicit-any */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: { id: number; username?: string; first_name?: string };
    start_param?: string;
  };
  expand: () => void;
  ready: () => void;
  close: () => void;
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    button_color?: string;
    button_text_color?: string;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    setText: (text: string) => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
}

export function isTelegramWebApp(): boolean {
  return typeof window !== "undefined" && !!(window as any).Telegram?.WebApp?.initData;
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return (window as any).Telegram?.WebApp ?? null;
}

export interface TelegramAuthResult {
  access_token: string;
  user_id: string;
  is_new_user: boolean;
}

export async function authenticateWithTelegram(
  referralCode?: string,
): Promise<TelegramAuthResult | null> {
  const tg = getTelegramWebApp();
  if (!tg || !tg.initData) return null;

  try {
    const res = await fetch(`${BASE}/api/auth/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        init_data: tg.initData,
        telegram_id: tg.initDataUnsafe?.user?.id,
        telegram_username: tg.initDataUnsafe?.user?.username ?? null,
        referral_code: referralCode ?? null,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Read the tg_param URL query and parse routing intent. */
export function parseTgParam(search: string): {
  referralCode?: string;
  agencyId?: string;
  redirectPath?: string;
} {
  const params = new URLSearchParams(search);
  const raw = params.get("tg_param") ?? "";
  if (!raw) return {};

  if (raw.startsWith("ref_")) return { referralCode: raw.slice(4) };
  if (raw.startsWith("agency_")) return { agencyId: raw.slice(7) };
  if (raw.startsWith("reminder_")) return { redirectPath: `/${raw.slice(9)}` };

  return {};
}
