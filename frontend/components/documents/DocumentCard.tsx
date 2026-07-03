"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [expanded, setExpanded] = useState(false);
  const isRisk = Boolean(doc.risk_note);

  return (
    <motion.div
      layout
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        doc.completed
          ? "border-[#1E1E2E] opacity-70"
          : isRisk
          ? "border-l-4 border-l-[#F59E0B] border-[#1E1E2E] bg-[#F59E0B]/5"
          : "border-[#1E1E2E] bg-[#13131A]"
      }`}
    >
      <div className="px-4 py-3.5 flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => !disabled && onToggle(doc.id, !doc.completed)}
          disabled={disabled}
          className={`shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-all ${
            doc.completed
              ? "bg-[#00D4AA] border-[#00D4AA]"
              : "border-[#3E3E5E] hover:border-[#6C63FF]"
          } disabled:opacity-50`}
          aria-label={doc.completed ? "Отметить как не готово" : "Отметить как готово"}
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
            <span className={`text-sm font-medium leading-snug ${doc.completed ? "line-through text-[#8B8BA7]" : "text-[#F0F0FF]"}`}>
              {doc.name}
            </span>
            {isRisk && !doc.completed && (
              <span className="text-[10px] font-bold text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded">
                РИСК
              </span>
            )}
          </div>

          <p className="text-[#8B8BA7] text-xs mt-0.5 leading-relaxed">{doc.description}</p>

          {isRisk && doc.risk_note && !doc.completed && (
            <p className="text-[#F59E0B] text-xs mt-1 leading-relaxed">{doc.risk_note}</p>
          )}

          {/* Tips toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 mt-1.5 text-[#6C63FF] text-xs hover:text-[#9C8BFF] transition-colors"
          >
            <span>💡</span>
            <span>{expanded ? "Скрыть подсказку" : "Подсказка"}</span>
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
                <p className="text-[#8B8BA7] text-xs mt-1.5 bg-[#6C63FF]/5 border border-[#6C63FF]/15 rounded-lg px-3 py-2 leading-relaxed">
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
