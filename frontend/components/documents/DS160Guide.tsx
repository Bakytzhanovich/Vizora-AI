"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { DS160Step as DS160StepType } from "@/lib/api";
import { DS160Step } from "./DS160Step";

interface Props {
  steps: DS160StepType[];
}

export function DS160Guide({ steps }: Props) {
  const { t } = useTranslation("documents");
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-primary font-bold text-lg">{t("ds160.title")}</h2>
        <p className="text-secondary text-sm mt-1">{t("ds160.subtitle")}</p>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-6">
        {steps.map((s) => (
          <div
            key={s.step}
            className="w-7 h-7 rounded-full bg-border flex items-center justify-center text-[10px] text-secondary font-medium"
          >
            {s.step}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <motion.div
            key={step.step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <DS160Step step={step} isActive={step.step === 1} />
          </motion.div>
        ))}
      </div>

      <div className="mt-6 bg-teal/5 border border-teal/20 rounded-2xl p-4">
        <p className="text-teal text-xs font-semibold mb-1">{t("ds160.tip_title")}</p>
        <p className="text-secondary text-xs leading-relaxed">
          {t("ds160.tip_text")}
        </p>
      </div>
    </div>
  );
}
