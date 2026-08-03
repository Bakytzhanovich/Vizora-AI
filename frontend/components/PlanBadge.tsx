"use client";

import { useRouter } from "next/navigation";
import type { SubscriptionInfo } from "@/lib/api";

const PLAN_LABELS: Record<string, string> = {
  free: "🆓 Бесплатный",
  standard: "⭐ Стандарт",
  premium: "💎 Премиум",
  agency_starter: "🏢 Agency Starter",
  agency_business: "🏢 Agency Business",
  agency_partner: "🏢 Agency Partner",
};

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function PlanBadge({ subscription }: { subscription: SubscriptionInfo | null }) {
  const router = useRouter();
  if (!subscription) return null;

  // A failed renewal charge on an already-active paid plan — the only
  // non-"active" state left now that FREE is permanent (no more trial/expired).
  if (subscription.banner?.type === "danger" && subscription.plan !== "free") {
    return (
      <button
        onClick={() => router.push("/pricing?renew=1")}
        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FF6B6B]/15 text-[#FF6B6B]"
      >
        ⚠️ Проблема с оплатой
      </button>
    );
  }

  if (subscription.plan === "free") {
    return (
      <button
        onClick={() => router.push("/pricing")}
        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#6C63FF]/15 text-[#6C63FF]"
      >
        {PLAN_LABELS.free}
      </button>
    );
  }

  const label = PLAN_LABELS[subscription.plan] ?? subscription.plan;
  const until = subscription.period_end ? ` • до ${formatShortDate(subscription.period_end)}` : "";
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#00D4AA]/15 text-[#00D4AA]">
      {label}
      {until}
    </span>
  );
}
