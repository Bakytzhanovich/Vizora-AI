"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react";
import { apiGetPlans } from "@/lib/api";

function formatKzt(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸";
}

/** Shown once a FREE-plan user hits their daily FAQ question cap. */
export function FaqLimitCard() {
  const router = useRouter();
  const { t } = useTranslation("chat");
  const [faqPerDay, setFaqPerDay] = useState<number | null>(null);
  const [standardPriceKzt, setStandardPriceKzt] = useState<number | null>(null);

  useEffect(() => {
    apiGetPlans()
      .then((d) => {
        const free = d.plans.find((p) => p.id === "free");
        const standard = d.plans.find((p) => p.id === "standard");
        if (free?.limits.faq_per_day != null) setFaqPerDay(free.limits.faq_per_day);
        if (standard) setStandardPriceKzt(standard.prices_kzt.monthly);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl mx-auto mb-3 rounded-2xl border border-accent/30 bg-card p-4 text-center">
      <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mx-auto mb-2">
        <MessageCircle size={18} className="text-accent" />
      </div>
      <p className="text-primary font-semibold text-sm mb-1">
        {t("faq_limit.used_today", { count: faqPerDay ?? 10 })}
      </p>
      <p className="text-secondary text-xs mb-4">{t("faq_limit.resets_tomorrow")}</p>
      <button
        onClick={() => router.push("/pricing")}
        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-accent hover:bg-accent-hover text-white transition-colors"
      >
        {standardPriceKzt !== null
          ? t("faq_limit.get_unlimited_price", { price: formatKzt(standardPriceKzt) })
          : t("faq_limit.get_unlimited")}
      </button>
    </div>
  );
}
