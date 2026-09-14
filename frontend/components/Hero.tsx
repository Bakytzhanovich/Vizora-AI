"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { useTranslation } from "react-i18next";

// TODO: stats[0] (4100+) and stats[3] (250000+) are real numbers but were
// originally scoped to J-1/Work & Travel specifically (KZ J-1 applicants,
// global W&T population) — the i18n labels were generalized to drop the
// visa-category wording for the multi-visa-roadmap positioning, but the
// underlying counts themselves haven't been re-sourced for that broader
// scope. Revisit once real cross-program numbers exist; don't just relabel
// further without new data.
const statValues = [4100, 46, 3, 250000];

interface Stat {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

function StatCard({
  stat,
  inView,
  index,
}: {
  stat: Stat;
  inView: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
      className="text-center px-4"
    >
      <div className="text-2xl sm:text-3xl font-bold text-[#F0F0FF] mb-1">
        {stat.prefix ?? ""}
        {stat.value.toLocaleString("ru-RU")}
        {stat.suffix}
      </div>
      <div className="text-xs sm:text-sm text-[#8B8BA7] max-w-[140px] mx-auto leading-tight">
        {stat.label}
      </div>
    </motion.div>
  );
}

export function Hero() {
  const router = useRouter();
  const { t } = useTranslation("landing");
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const statTranslations = t("hero.stats", { returnObjects: true }) as {
    prefix?: string;
    suffix?: string;
    label: string;
  }[];
  const stats: Stat[] = statValues.map((value, i) => ({ value, ...statTranslations[i] }));

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="students"
      ref={ref}
      className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 px-4 overflow-hidden bg-grid"
    >
      {/* Glow background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[#6C63FF]/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-[#00D4AA]/5 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Badges — wrap so the secondary (country-scope) pill drops to its
            own line on narrow screens instead of overflowing */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 bg-[#6C63FF]/10 border border-[#6C63FF]/30 text-[#9C8BFF] text-xs font-semibold px-4 py-2 rounded-full"
          >
            <span className="w-2 h-2 bg-[#6C63FF] rounded-full animate-pulse" />
            {t("hero.badge")}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-[#13131A]/60 border border-[#1E1E2E] text-[#8B8BA7] text-xs font-semibold px-4 py-2 rounded-full"
          >
            {t("hero.badge_secondary")}
          </motion.div>
        </div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-[#F0F0FF] leading-tight tracking-tight mb-6"
        >
          {t("hero.title_line1")}{" "}
          <span className="relative">
            <span className="bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] bg-clip-text text-transparent">
              {t("hero.title_highlight")}
            </span>
          </span>
          <br />
          {t("hero.title_line2")}
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl text-[#8B8BA7] max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          {t("hero.subtitle_line1")}
          <br className="hidden sm:block" />
          {t("hero.subtitle_line2")}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <motion.button
            onClick={() => router.push("/register")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] text-white font-semibold px-8 py-4 rounded-xl shadow-lg shadow-[#6C63FF]/30 transition-all duration-200 text-base"
          >
            {t("hero.cta_start")}
            <ArrowRight size={18} />
          </motion.button>
          <motion.button
            onClick={() => handleScroll("#how-it-works")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 border border-[#1E1E2E] hover:border-[#6C63FF]/40 text-[#F0F0FF] font-semibold px-8 py-4 rounded-xl transition-all duration-200 text-base bg-[#13131A]/50 backdrop-blur-sm"
          >
            <Play size={16} className="text-[#6C63FF]" />
            {t("hero.cta_demo")}
          </motion.button>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="border border-[#1E1E2E] bg-[#13131A]/60 backdrop-blur-sm rounded-2xl p-6 sm:p-8"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 divide-y-0 lg:divide-x lg:divide-[#1E1E2E]">
            {stats.map((stat, i) => (
              <StatCard key={i} stat={stat} inView={inView} index={i} />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <div className="w-5 h-8 rounded-full border border-[#1E1E2E] flex items-start justify-center pt-1">
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-1.5 h-1.5 rounded-full bg-[#6C63FF]"
          />
        </div>
      </motion.div>
    </section>
  );
}
