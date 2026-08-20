import Link from "next/link";
import type { AgencyBilling } from "@/lib/agency-api";
import { formatDate } from "@/lib/format";

const PLAN_NAMES: Record<string, string> = {
  agency_starter: "Agency Starter",
  agency_business: "Agency Business",
  agency_partner: "Agency Partner",
};

export function BillingBadge({ billing }: { billing: AgencyBilling }) {
  if (billing.status === "paid" && billing.period_end) {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-semibold">
        {PLAN_NAMES[billing.plan ?? ""] ?? billing.plan} · до {formatDate(billing.period_end)}
      </span>
    );
  }

  if (billing.status === "free" && billing.free_until) {
    return (
      <span className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold">
        Бесплатный период · до {formatDate(billing.free_until)}
      </span>
    );
  }

  // expired_paid or expired_free
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full text-xs font-semibold">
        ⚠️ Период истёк
      </span>
      <Link href="/agency/pricing" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
        Выбрать план →
      </Link>
    </span>
  );
}
