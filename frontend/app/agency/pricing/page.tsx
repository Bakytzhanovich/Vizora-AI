"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { AgencyLayout } from "@/components/agency/AgencyLayout";
import { AgencyCheckoutModal } from "@/components/agency/AgencyCheckoutModal";
import { apiGetPlans, type Plan } from "@/lib/api";
import { agencyGetMe, type AgencyMe } from "@/lib/agency-api";

const AGENCY_PLAN_IDS = ["agency_starter", "agency_business", "agency_partner"];

function formatKzt(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸";
}

export default function AgencyPricingPage() {
  const [me, setMe] = useState<AgencyMe | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([agencyGetMe(), apiGetPlans()])
      .then(([meData, plansData]) => {
        setMe(meData);
        setPlans(plansData.plans.filter((p) => AGENCY_PLAN_IDS.includes(p.id)));
      })
      .catch(() => setError("Не удалось загрузить тарифы"))
      .finally(() => setLoading(false));
  }, []);

  const handleActivated = () => {
    setCheckoutPlan(null);
    agencyGetMe().then(setMe).catch(() => {});
  };

  return (
    <AgencyLayout requireAdmin>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Тарифы для агентств</h1>
          <p className="text-gray-500">Выберите план, который подходит размеру вашей команды</p>
        </div>

        <div className="flex justify-center mb-10">
          <div className="inline-flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                billingPeriod === "monthly" ? "bg-blue-600 text-white" : "text-gray-500"
              }`}
            >
              Помесячно
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                billingPeriod === "yearly" ? "bg-blue-600 text-white" : "text-gray-500"
              }`}
            >
              На год (−30%)
            </button>
          </div>
        </div>

        {error && <div className="max-w-md mx-auto mb-6 text-center text-sm text-red-500">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5 mb-10">
            {plans.map((plan, i) => {
              const isPopular = plan.id === "agency_business";
              const isCurrent = me?.billing.status === "paid" && me.billing.plan === plan.id;
              const price = plan.prices_kzt[billingPeriod];
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-6 border flex flex-col bg-white ${
                    isPopular ? "border-blue-500 shadow-lg shadow-blue-500/10" : "border-gray-200"
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-blue-600 text-white">
                      ⭐ Популярный
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
                  <div className="mb-5">
                    <span className="text-3xl font-bold text-gray-900">{formatKzt(price)}</span>
                    <span className="text-gray-500 text-sm">
                      {billingPeriod === "monthly" ? " / мес" : " / год"}
                    </span>
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1 text-sm">
                    <li className="flex items-start gap-2">
                      <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-gray-700">
                        {i === 0 ? "До 20 студентов" : i === 1 ? "До 60 студентов" : "Без ограничений по студентам"}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-gray-700">Полный доступ к симулятору и AI-консулу</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-gray-700">Аналитика и алерты по команде</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-gray-700">White-label брендинг</span>
                    </li>
                    {i >= 1 && (
                      <li className="flex items-start gap-2">
                        <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-gray-700">Менеджеры и распределение студентов</span>
                      </li>
                    )}
                    {i === 2 && (
                      <li className="flex items-start gap-2">
                        <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-gray-700">Приоритетная поддержка</span>
                      </li>
                    )}
                  </ul>
                  <button
                    onClick={() => setCheckoutPlan(plan.id)}
                    disabled={isCurrent}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
                      isPopular ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                    }`}
                  >
                    {isCurrent ? "Текущий план" : "Подключить"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {checkoutPlan && (() => {
        const plan = plans.find((p) => p.id === checkoutPlan);
        if (!plan) return null;
        const price = plan.prices_kzt[billingPeriod];
        return (
          <AgencyCheckoutModal
            plan={plan.id}
            planLabel={plan.name}
            billingPeriod={billingPeriod}
            amountLabel={formatKzt(price) + (billingPeriod === "monthly" ? " / мес" : " / год")}
            onClose={() => setCheckoutPlan(null)}
            onActivated={handleActivated}
          />
        );
      })()}
    </AgencyLayout>
  );
}
