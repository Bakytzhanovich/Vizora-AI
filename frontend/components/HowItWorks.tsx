"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useTranslation } from "react-i18next";
import { UserCircle, Target, Mic, Plane, Sparkles } from "lucide-react";
import { IconTile } from "@/components/ui/IconTile";
import { ProductPreviewPlaceholder } from "@/components/ui/ProductPreviewPlaceholder";

interface Step {
  number: string;
  title: string;
  description: string;
  detail: string;
}

const icons = [UserCircle, Target, Mic, Plane];

export function HowItWorks() {
  const { t } = useTranslation("landing");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const steps = t("how_it_works.steps", { returnObjects: true }) as Step[];

  return (
    <section id="how-it-works" ref={ref} className="py-24 lg:py-32 px-4 relative">
      <div className="max-w-6xl mx-auto">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-4"
        >
          <span className="text-xs font-semibold text-[#9C8BFF] uppercase tracking-widest">
            {t("how_it_works.label")}
          </span>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F0F0FF] text-center mb-4 tracking-tight"
        >
          {t("how_it_works.title")}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-[#8B8BA7] text-center text-base sm:text-lg max-w-xl mx-auto mb-16"
        >
          {t("how_it_works.subtitle")}
        </motion.p>

        {/* Asymmetric: vertical timeline + reserved product preview */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-12 items-start">
          {/* Timeline */}
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-[#6C63FF]/40 via-[#1E1E2E] to-transparent" />

            <div className="flex flex-col gap-8">
              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                  className="relative flex gap-5"
                >
                  {/* Bare step number, no rounded-tile frame */}
                  <div className="relative z-10 shrink-0 w-10 h-10 rounded-full bg-[#0A0A0F] border border-[#6C63FF]/30 flex items-center justify-center">
                    <span className="font-heading text-sm font-bold text-[#6C63FF] tabular-nums">
                      {i + 1}
                    </span>
                  </div>

                  <div className="pt-1 pb-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <IconTile icons={icons} index={i} size={18} className="text-[#6C63FF]" />
                      <h3 className="text-[#F0F0FF] font-bold text-base leading-snug">
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-[#8B8BA7] text-sm leading-relaxed mb-2">
                      {step.description}
                    </p>
                    <p className="text-[#8B8BA7]/60 text-xs italic leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Reserved space for a real product screenshot/video */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="lg:sticky lg:top-24"
          >
            <ProductPreviewPlaceholder />
          </motion.div>
        </div>

        {/* Bottom quote */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-3 bg-[#13131A] border border-[#1E1E2E] rounded-2xl px-6 py-4">
            <Sparkles size={20} strokeWidth={1.75} className="text-[#9C8BFF] shrink-0" />
            <p className="text-[#8B8BA7] text-sm">
              <span className="text-[#F0F0FF] font-semibold">{t("how_it_works.quote_bold")}</span>{" "}
              {t("how_it_works.quote_text")}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
