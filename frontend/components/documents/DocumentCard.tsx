"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { DocumentItem } from "@/lib/api";

interface Props {
  doc: DocumentItem;
  onToggle: (id: string, completed: boolean) => void;
  disabled?: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  identity: "🪪",
  program: "📋",
  visa: "🔖",
  fees: "💰",
  education: "🎓",
  financial: "💳",
  preparation: "🧠",
};

export function DocumentCard({ doc, onToggle, disabled }: Props) {
  const { t } = useTranslation("documents");
  const [expanded, setExpanded] = useState(false);
  const isRisk = Boolean(doc.risk_note);

  return (
    <motion.div
      layout
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        doc.completed
          ? "border-border opacity-70"
          : isRisk
          ? "border-l-4 border-l-warning border-border bg-warning/5"
          : "border-border bg-card"
      }`}
    >
      <div className="px-4 py-3.5 flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => !disabled && onToggle(doc.id, !doc.completed)}
          disabled={disabled}
          className={`shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-all ${
            doc.completed
              ? "bg-teal border-teal"
              : "border-secondary hover:border-accent"
          } disabled:opacity-50`}
          aria-label={doc.completed ? t("mark_undone_aria") : t("mark_done_aria")}
        >
          {doc.completed && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium leading-snug ${doc.completed ? "line-through text-secondary" : "text-primary"}`}>
              {doc.name}
            </span>
            {isRisk && !doc.completed && (
              <span className="text-[10px] font-bold text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                {t("risk_badge")}
              </span>
            )}
          </div>

          <p className="text-secondary text-xs mt-0.5 leading-relaxed">{doc.description}</p>

          {isRisk && doc.risk_note && !doc.completed && (
            <p className="text-warning text-xs mt-1 leading-relaxed">{doc.risk_note}</p>
          )}

          {/* Tips toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 mt-1.5 text-accent text-xs hover:text-accent-light transition-colors"
          >
            <span>💡</span>
            <span>{expanded ? t("hide_tip") : t("show_tip")}</span>
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="text-secondary text-xs mt-1.5 bg-accent/5 border border-accent/15 rounded-lg px-3 py-2 leading-relaxed">
                  {doc.tips}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Category icon */}
        <span className="shrink-0 text-base opacity-60">{CATEGORY_ICONS[doc.category] ?? "📄"}</span>
      </div>
    </motion.div>
  );
}
