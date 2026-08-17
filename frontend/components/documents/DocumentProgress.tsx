"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface Props {
  completed: number;
  total: number;
  progress: number;
}

export function DocumentProgress({ completed, total, progress }: Props) {
  const { t } = useTranslation("documents");
  return (
    <div className="bg-card border border-border rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-primary text-sm font-semibold">{t("readiness")}</span>
        <span className="text-accent text-sm font-bold">{progress}%</span>
      </div>
      <div className="h-2.5 bg-border rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-secondary">
        <span>
          {t("progress", { done: completed, total })}
        </span>
        {progress === 100 && (
          <span className="text-teal font-semibold">{t("all_done")}</span>
        )}
      </div>
    </div>
  );
}
