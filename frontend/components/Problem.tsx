"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useTranslation } from "react-i18next";

interface ProblemItem {
  icon: string;
  title: string;
  description: string;
  detail: string;
}

export function Problem() {
  const { t } = useTranslation("landing");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const problems = t("problem.items", { returnObjects: true }) as ProblemItem[];

  return (
    <section ref={ref} className="py-24 px-4 relative">
      <div className="max-w-6xl mx-auto">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-4"
        >
          <span className="text-xs font-semibold text-[#FF6B6B] uppercase tracking-widest">
            {t("problem.label")}
          </span>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F0F0FF] text-center mb-4 tracking-tight"
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

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-6 overflow-hidden"
            >
              {/* Red top accent line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF6B6B]/60 to-transparent" />

              {/* Red corner glow */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#FF6B6B]/5 rounded-full blur-2xl group-hover:bg-[#FF6B6B]/10 transition-all duration-300" />

              <div className="relative z-10">
                <div className="text-4xl mb-4">{p.icon}</div>

                <h3 className="text-[#F0F0FF] font-bold text-lg mb-3 leading-snug">
                  {p.title}
                </h3>

                <p className="text-[#8B8BA7] text-sm leading-relaxed mb-4">
                  {p.description}
                </p>

                <div className="border-t border-[#1E1E2E] pt-4">
                  <p className="text-[#8B8BA7]/70 text-xs leading-relaxed">
                    {p.detail}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom accent */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={inView ? { opacity: 1, scaleX: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-16 h-px bg-gradient-to-r from-transparent via-[#1E1E2E] to-transparent"
        />
      </div>
    </section>
  );
}
