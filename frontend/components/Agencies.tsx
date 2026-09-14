"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Clock, BarChart3, Trophy } from "lucide-react";
import { IconTile } from "@/components/ui/IconTile";

const benefitIcons = [Clock, BarChart3, Trophy];

interface Benefit {
  title: string;
  description: string;
  metric: string;
  metric_label: string;
}

interface Plan {
  id: string;
  name: string;
  period: string;
  students: string;
  features: string[];
}

// Kept in USD per product decision — Kaspi Pay checkout itself converts to
// KZT at payment time (see backend PLAN_PRICES_KZT in routers/payments.py).
// Keyed by plan id, not array position, so a reordered/edited i18n plans
// array can't silently pair the wrong price with the wrong tier.
const AGENCY_PLAN_PRICES_USD: Record<string, string> = {
  agency_starter: "$299",
  agency_business: "$599",
  agency_partner: "$999",
};
const AGENCY_PLAN_HIGHLIGHT: Record<string, boolean> = {
  agency_business: true,
};

export function Agencies() {
  const { t } = useTranslation("landing");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const benefits = t("agencies.benefits", { returnObjects: true }) as Benefit[];
  const plansData = t("agencies.plans", { returnObjects: true }) as Plan[];
  const plans = plansData.map((p) => ({
    ...p,
    price: AGENCY_PLAN_PRICES_USD[p.id] ?? "—",
    highlight: AGENCY_PLAN_HIGHLIGHT[p.id] ?? false,
  }));

  const handleScroll = () => {
    const el = document.querySelector("#early-access");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="agencies" ref={ref} className="py-24 lg:py-32 px-4 relative">
      {/* Slightly lighter background */}
      <div className="absolute inset-0 bg-[#13131A]/40" />

      <div className="relative max-w-6xl mx-auto">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-4"
        >
          <span className="text-xs font-semibold text-[#9C8BFF] uppercase tracking-widest">
            {t("agencies.label")}
          </span>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F0F0FF] text-center mb-3 tracking-tight"
        >
          {t("agencies.title")}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-[#8B8BA7] text-center text-base sm:text-lg mb-14"
        >
          {t("agencies.subtitle")}
        </motion.p>

        {/* Benefits — horizontal stat strip instead of a third card-grid
            pattern (Solution section already owns that layout language) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="border border-[#1E1E2E] bg-[#13131A]/60 backdrop-blur-sm rounded-2xl p-6 sm:p-8 mb-14"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 sm:divide-x sm:divide-[#1E1E2E]">
            {benefits.map((b, i) => (
              <div key={i} className="sm:px-6 first:sm:pl-0 last:sm:pr-0">
                <IconTile icons={benefitIcons} index={i} size={24} className="text-[#9C8BFF] mb-3" />
                <div className="font-heading text-3xl font-bold text-[#F0F0FF] tabular-nums mb-1">
                  {b.metric}
                </div>
                <div className="text-[#8B8BA7] text-xs mb-3">{b.metric_label}</div>
                <h3 className="text-[#F0F0FF] font-semibold text-sm mb-1.5">{b.title}</h3>
                <p className="text-[#8B8BA7] text-xs leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Pricing table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10"
        >
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 border transition-all duration-200 ${
                plan.highlight
                  ? "bg-gradient-to-br from-[#6C63FF]/10 to-[#9C8BFF]/5 border-[#6C63FF]/30 shadow-lg shadow-[#6C63FF]/10"
                  : "bg-[#13131A] border-[#1E1E2E]"
              }`}
            >
              {plan.highlight && (
                <div className="text-xs font-semibold text-[#6C63FF] bg-[#6C63FF]/10 border border-[#6C63FF]/20 rounded-full px-3 py-1 inline-block mb-3">
                  {t("agencies.popular_badge")}
                </div>
              )}
              <div className="text-[#8B8BA7] text-xs font-semibold uppercase tracking-wide mb-1">
                {plan.name}
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="font-heading text-3xl font-bold text-[#F0F0FF] tabular-nums">{plan.price}</span>
                <span className="text-[#8B8BA7] text-sm">{plan.period}</span>
              </div>
              <div className="text-[#8B8BA7] text-xs mb-5">{plan.students}</div>
              <ul className="space-y-2.5">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-[#8B8BA7]">
                    <span className="text-[#9C8BFF] mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>

        {/* CTA — same violet brand button as everywhere else, outline
            variant so it still reads as distinct from the primary hero CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="flex justify-center"
        >
          <motion.button
            onClick={handleScroll}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="border border-[#6C63FF]/40 hover:border-[#6C63FF] text-[#9C8BFF] font-bold px-8 py-4 rounded-xl bg-[#6C63FF]/5 hover:bg-[#6C63FF]/10 text-sm transition-all duration-200"
          >
            {t("agencies.cta")}
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
