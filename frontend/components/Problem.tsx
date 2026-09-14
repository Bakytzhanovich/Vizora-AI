"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Target, AlertTriangle, Moon } from "lucide-react";
import { IconTile } from "@/components/ui/IconTile";

interface ProblemItem {
  title: string;
  description: string;
  detail: string;
}

const icons = [Target, AlertTriangle, Moon];

export function Problem() {
  const { t } = useTranslation("landing");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const problems = t("problem.items", { returnObjects: true }) as ProblemItem[];
  const statHighlight = t("problem.stat_highlight", { returnObjects: true }) as {
    value: string;
    label: string;
  };

  return (
    <section ref={ref} className="py-24 lg:py-32 px-4 relative">
      <div className="max-w-6xl mx-auto">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-4"
        >
          <span className="text-xs font-semibold text-[#C9A876] uppercase tracking-widest">
            {t("problem.label")}
          </span>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F0F0FF] text-center mb-4 tracking-tight"
        >
          {t("problem.title")}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-[#8B8BA7] text-center text-base sm:text-lg max-w-2xl mx-auto mb-14"
        >
          {t("problem.subtitle")}
        </motion.p>

        {/* Asymmetric split: big stat card + compact item list */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-6 lg:gap-8 items-stretch">
          {/* Left: stat card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="relative bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-8 sm:p-10 flex flex-col justify-center overflow-hidden"
          >
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#C9A876]/[0.06] rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="font-heading text-6xl sm:text-7xl font-bold text-[#C9A876] tabular-nums leading-none mb-4">
                {statHighlight.value}
              </div>
              <p className="text-[#8B8BA7] text-base sm:text-lg leading-relaxed max-w-xs">
                {statHighlight.label}
              </p>
            </div>
          </motion.div>

          {/* Right: compact item list */}
          <div className="flex flex-col gap-3">
            {problems.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                className="flex gap-4 bg-[#13131A] border border-[#1E1E2E] rounded-xl p-5"
              >
                <IconTile icons={icons} index={i} size={22} className="text-[#C9A876] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-[#F0F0FF] font-semibold text-base mb-1 leading-snug">
                    {p.title}
                  </h3>
                  <p className="text-[#8B8BA7] text-sm leading-relaxed">
                    {p.description}
                  </p>
                  <p className="text-[#8B8BA7]/60 text-xs leading-relaxed mt-2">
                    {p.detail}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
