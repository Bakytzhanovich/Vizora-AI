"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGetPlans } from "@/lib/api";

function formatKzt(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸";
}

/** Shown once a FREE-plan user hits their daily FAQ question cap. */
export function FaqLimitCard() {
  const router = useRouter();
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
    <div className="max-w-2xl mx-auto mb-3 rounded-2xl border border-[#6C63FF]/30 bg-[#13131A] p-4 text-center">
      <div className="text-2xl mb-2">💬</div>
      <p className="text-[#F0F0FF] font-semibold text-sm mb-1">
        Лимит {faqPerDay ?? 5} вопросов на сегодня
      </p>
      <p className="text-[#8B8BA7] text-xs mb-4">
        Завтра обновится, или подпишись для безлимитного доступа
      </p>
      <button
        onClick={() => router.push("/pricing")}
        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#6C63FF] hover:bg-[#7C75FF] text-white transition-colors"
      >
        {standardPriceKzt !== null ? `СТАНДАРТ ${formatKzt(standardPriceKzt)} →` : "Выбрать план →"}
      </button>
    </div>
  );
}
