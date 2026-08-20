"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, Map, MessageCircle, Mic, FileText, User, LogOut, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { BrandedLogo } from "@/components/branding/BrandedLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LogoutConfirmModal } from "@/components/ui/LogoutConfirmModal";

const NAV_ITEMS: { href: string; icon: LucideIcon; key: string }[] = [
  { href: "/dashboard", icon: Home, key: "dashboard" },
  { href: "/roadmap", icon: Map, key: "roadmap" },
  { href: "/chat", icon: MessageCircle, key: "chat" },
  { href: "/simulator", icon: Mic, key: "simulator" },
  { href: "/documents", icon: FileText, key: "documents" },
];

/** Persistent left nav for the desktop app shell — the lg+ counterpart to
 * BottomNav (which stays mobile-only). Wraps dashboard/roadmap/documents/
 * profile via app/(shell)/layout.tsx; chat and simulator keep their own
 * full-bleed immersive layout on every width, same as they already do on
 * mobile (see BottomNav's HIDDEN_PREFIXES). */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const logout = () => {
    ["access_token", "refresh_token", "user_id", "has_profile", "user_name"].forEach(
      (k) => localStorage.removeItem(k)
    );
    router.push("/login");
  };

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:border-r lg:border-border lg:bg-card/40">
        <div className="px-5 py-6">
          <BrandedLogo />
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, icon: Icon, key }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-secondary hover:text-primary hover:bg-border"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.25 : 2} />
                {t(`nav.${key}`)}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-3">
          <button
            onClick={() => router.push("/profile")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              pathname === "/profile" || pathname.startsWith("/profile/")
                ? "bg-accent/10 text-accent"
                : "text-secondary hover:text-primary hover:bg-border"
            }`}
          >
            <User size={18} />
            {t("nav.profile")}
          </button>
        </div>

        <div className="px-3 pb-5 pt-3 border-t border-border space-y-3">
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-secondary hover:text-primary hover:bg-border transition-colors"
          >
            <LogOut size={16} />
            {t("nav.logout")}
          </button>
        </div>
      </aside>

      {showLogoutConfirm && (
        <LogoutConfirmModal onConfirm={logout} onCancel={() => setShowLogoutConfirm(false)} />
      )}
    </>
  );
}
