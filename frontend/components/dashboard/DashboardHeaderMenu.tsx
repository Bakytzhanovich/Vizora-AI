"use client";

import { useEffect, useRef, useState } from "react";
import { EllipsisVertical, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PlanBadge } from "@/components/PlanBadge";
import type { SubscriptionInfo } from "@/lib/api";

interface Props {
  subscription: SubscriptionInfo | null;
  onLogout: () => void;
}

/** Collapses the plan badge, language switcher, and logout button into a
 * single overflow menu — mirrors how native apps keep the header bar down
 * to one compact affordance instead of a row of separate controls. */
export function DashboardHeaderMenu({ subscription, onLogout }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-[#1E1E2E] hover:bg-[#26263A] flex items-center justify-center transition-colors shrink-0"
        aria-label="Menu"
      >
        <EllipsisVertical size={18} className="text-[#F0F0FF]" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 w-56 bg-[#13131A] border border-[#1E1E2E] rounded-2xl shadow-xl shadow-black/40 p-3 flex flex-col gap-3">
          <PlanBadge subscription={subscription} />
          <LanguageSwitcher />
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-[#8B8BA7] hover:text-[#F0F0FF] text-sm font-medium px-2.5 py-2 rounded-lg bg-[#1E1E2E] hover:bg-[#26263A] transition-colors"
          >
            <LogOut size={14} />
            {t("common:nav.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
