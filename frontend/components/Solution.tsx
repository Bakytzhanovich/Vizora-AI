"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Bot, Mic, FileText } from "lucide-react";
import { IconTile } from "@/components/ui/IconTile";

interface SolutionFeature {
  title: string;
  description: string;
  bullets: string[];
  badge: string;
}

const icons = [Bot, Mic, FileText];
const badgeColor = "bg-[#6C63FF]/10 text-[#9C8BFF] border-[#6C63FF]/20";

interface RiskItem {
  risk: string;
  severity: string;
  questions: string[];
}

export function Solution() {
  const { t } = useTranslation("landing");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const features = t("solution.features", { returnObjects: true }) as SolutionFeature[];
  const riskItems = t("solution.risk_preview.items", { returnObjects: true }) as RiskItem[];
  const riskColors = ["#FF6B6B", "#F59E0B", "#FF6B6B"];

  return (
    <section id="solution" ref={ref} className="py-24 px-4 relative">
      {/* Subtle glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#6C63FF]/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto relative">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-4"
        >
          <span className="text-xs font-semibold text-[#6C63FF] uppercase tracking-widest">
            {t("solution.label")}
          </span>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F0F0FF] text-center mb-3 tracking-tight"
        >
          {t("solution.title")}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-[#8B8BA7] text-center text-base sm:text-lg mb-14"
        >
          {t("solution.subtitle")}
        </motion.p>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative bg-[#13131A] border border-[#1E1E2E] hover:border-[#6C63FF]/30 rounded-2xl p-6 overflow-hidden transition-colors duration-300"
            >
              {/* Purple top accent */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#6C63FF]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Purple corner glow */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#6C63FF]/5 rounded-full blur-2xl group-hover:bg-[#6C63FF]/10 transition-all duration-300" />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <IconTile icons={icons} index={i} size={32} className="text-[#9C8BFF]" />
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeColor}`}>
                    {f.badge}
                  </span>
                </div>

                <h3 className="text-[#F0F0FF] font-bold text-lg mb-3">
                  {f.title}
                </h3>

                <p className="text-[#8B8BA7] text-sm leading-relaxed mb-5">
                  {f.description}
                </p>

                <ul className="space-y-2">
                  {f.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-[#8B8BA7]/80">
                      <span className="text-[#6C63FF] mt-0.5 shrink-0">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Profile risk preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-10 bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-6 sm:p-8"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#6C63FF]/10 border border-[#6C63FF]/20 flex items-center justify-center text-lg shrink-0">
              🎯
            </div>
            <div>
              <div className="text-[#F0F0FF] font-semibold text-sm">{t("solution.risk_preview.title")}</div>
              <div className="text-[#8B8BA7] text-xs mt-0.5">{t("solution.risk_preview.subtitle")}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {riskItems.map((item, i) => (
              <div key={i} className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: riskColors[i] }} />
                  <span className="text-xs font-semibold" style={{ color: riskColors[i] }}>
                    {item.severity} {t("solution.risk_preview.risk_suffix")}
                  </span>
                </div>
                <div className="text-[#F0F0FF] text-xs font-medium mb-2">{item.risk}</div>
                <div className="space-y-1">
                  {item.questions.map((q, j) => (
                    <div key={j} className="text-[#8B8BA7]/60 text-xs italic">&ldquo;{q}&rdquo;</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
