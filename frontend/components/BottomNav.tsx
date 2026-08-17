"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Map, MessageCircle, Mic, User, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

const TABS: { href: string; icon: LucideIcon; key: string }[] = [
  { href: "/dashboard", icon: Home, key: "dashboard" },
  { href: "/roadmap", icon: Map, key: "roadmap" },
  { href: "/chat", icon: MessageCircle, key: "chat" },
  { href: "/simulator", icon: Mic, key: "simulator" },
  { href: "/profile", icon: User, key: "profile" },
];

// Routes with their own full-screen/immersive layout (live chat thread with a
// fixed input bar, an in-progress interview session, auth screens, other
// role shells with their own nav) hide the bar instead of stacking a second
// one on top.
const HIDDEN_PREFIXES = ["/chat", "/simulator", "/login", "/register", "/admin", "/agency", "/onboarding", "/pricing"];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation("common");

  if (pathname === "/" || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#13131A]/95 backdrop-blur-xl border-t border-[#1E1E2E]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch max-w-5xl mx-auto">
        {TABS.map(({ href, icon: Icon, key }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-w-0"
            >
              <Icon size={22} className={active ? "text-[#6C63FF]" : "text-[#8B8BA7]"} strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[10px] font-medium truncate max-w-full px-1 ${active ? "text-[#6C63FF]" : "text-[#8B8BA7]"}`}>
                {t(`nav.${key}`)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
