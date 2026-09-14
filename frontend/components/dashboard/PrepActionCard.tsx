"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Map, ArrowRight } from "lucide-react";

interface Props {
  progress: number;
  href: string;
}

/** Merged "what do I do next" card — replaces two separate blocks (a plain
 * progress bar card + a Roadmap ModuleCard) that said the same thing two
 * ways. The one card on the dashboard that gets real elevation (shadow +
 * accent glow); everything else stays flat so this reads as the single
 * primary action, not one of several equally-weighted cards. */
export function PrepActionCard({ progress, href }: Props) {
  const router = useRouter();
  const { t } = useTranslation("dashboard");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => router.push(href)}
      className="relative overflow-hidden bg-gradient-to-br from-accent/10 to-accent/[0.02] border border-accent/30 rounded-2xl p-5 cursor-pointer hover:border-accent/50 transition-all duration-200 active:scale-[0.99] shadow-lg shadow-accent/10"
    >
      <div className="absolute -top-14 -right-14 w-40 h-40 bg-accent-light/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 text-accent-light text-[11px] font-bold uppercase tracking-wide">
            <Map size={13} strokeWidth={2} />
            {t("prep_plan_label")}
          </span>
          <span className="text-accent-light text-sm font-bold tabular-nums">{progress}%</span>
        </div>

        <div className="h-1.5 bg-border rounded-full overflow-hidden mb-4">
          <motion.div
            className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          />
        </div>

        <h2 className="text-primary font-bold text-base mb-3">{t("continue_hint")}</h2>

        <button className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm py-3 rounded-xl transition-colors">
          {t("continue_action")}
          <ArrowRight size={16} />
        </button>
      </div>
    </motion.div>
  );
}
