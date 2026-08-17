"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Lock, type LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  locked?: boolean;
  href?: string | null;
  index: number;
  featured?: boolean;
  subtitle?: string;
}

export function ModuleCard({ icon: Icon, title, locked = true, href, index, featured = false, subtitle }: Props) {
  const router = useRouter();
  const { t } = useTranslation("dashboard");

  const handleClick = () => {
    if (!locked && href) router.push(href);
  };

  if (featured) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={handleClick}
        className="relative bg-gradient-to-r from-accent/15 to-accent/5 border border-accent/40 rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:border-accent transition-all duration-200 active:scale-[0.99] shadow-lg shadow-accent/5"
      >
        <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <Icon size={22} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-primary font-semibold text-base">{title}</span>
            <span className="text-[10px] font-bold bg-accent/20 text-accent-light px-2 py-0.5 rounded-full">
              {t("recommended_badge")}
            </span>
          </div>
          {subtitle && <p className="text-secondary text-xs">{subtitle}</p>}
        </div>
        <span className="text-accent shrink-0">›</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
      onClick={handleClick}
      className={`relative bg-card border rounded-2xl p-5 flex flex-col gap-3 overflow-hidden transition-all duration-200 ${
        locked
          ? "border-border opacity-60"
          : "border-accent/30 hover:border-accent hover:bg-accent/5 cursor-pointer shadow-lg shadow-accent/5"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          locked ? "bg-secondary/10" : "bg-accent/15"
        }`}
      >
        <Icon size={20} className={locked ? "text-secondary" : "text-accent"} />
      </div>
      <div>
        <div className="text-primary font-semibold text-sm">{title}</div>
        {locked ? (
          <div className="text-secondary text-xs mt-1 flex items-center gap-1">
            <Lock size={11} /> {t("coming_soon")}
          </div>
        ) : (
          <div className="text-accent text-xs mt-1 flex items-center gap-1">
            <span>→</span> {t("open")}
          </div>
        )}
      </div>
      {locked && <div className="absolute inset-0 bg-bg/20 rounded-2xl" />}
    </motion.div>
  );
}
