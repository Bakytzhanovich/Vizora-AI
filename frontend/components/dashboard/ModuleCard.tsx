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
        className="relative bg-card border border-accent/30 rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:border-accent/60 transition-all duration-200 active:scale-[0.99]"
      >
        <div className="w-9 h-9 flex items-center justify-center shrink-0">
          <Icon size={24} strokeWidth={1.75} className="text-accent" />
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
      className={`relative bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 overflow-hidden transition-all duration-200 ${
        locked ? "opacity-60" : "hover:border-accent/50 hover:bg-accent/5 cursor-pointer"
      }`}
    >
      <div className="w-9 h-9 flex items-center justify-center">
        <Icon size={22} strokeWidth={1.75} className={locked ? "text-secondary" : "text-accent"} />
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
