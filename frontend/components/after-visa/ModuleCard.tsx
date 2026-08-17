"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { AfterVisaModuleSummary } from "@/lib/api";
import { ProgressBadge } from "./ProgressBadge";

interface ModuleCardProps {
  module: AfterVisaModuleSummary;
  index: number;
}

export function ModuleCard({ module, index }: ModuleCardProps) {
  const router = useRouter();
  const isComplete = module.completed === module.total && module.total > 0;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      onClick={() => router.push(`/after-visa/${module.id}`)}
      className={`w-full text-left bg-card rounded-2xl p-4 border-l-4 transition-all active:scale-[0.98] ${
        isComplete
          ? "border-l-teal border border-teal/20"
          : "border-l-teal/50 border border-border hover:border-teal/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">{module.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-primary font-semibold text-sm leading-tight">
              {module.title}
            </span>
            {isComplete && (
              <span className="shrink-0 text-teal text-lg leading-none">✓</span>
            )}
          </div>
          <p className="text-secondary text-xs mb-2 leading-snug">{module.description}</p>
          <ProgressBadge
            completed={module.completed}
            total={module.total}
            pct={module.pct}
            size="sm"
          />
        </div>
      </div>
    </motion.button>
  );
}
