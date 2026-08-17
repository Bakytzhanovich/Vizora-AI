"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AfterVisaSection } from "@/lib/api";

interface SectionContentProps {
  section: AfterVisaSection;
  index: number;
  moduleId: string;
  onToggle: (sectionId: string, completed: boolean) => Promise<void>;
  updating?: boolean;
}

export function SectionContent({
  section,
  index,
  onToggle,
  updating,
}: SectionContentProps) {
  const [isOpen, setIsOpen] = useState(index === 0);

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        section.completed
          ? "bg-teal/10 border-teal/20"
          : "bg-card border-border"
      }`}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              section.completed
                ? "bg-teal text-bg"
                : "bg-border text-secondary"
            }`}
          >
            {section.completed ? "✓" : index + 1}
          </span>
          <span
            className={`font-semibold text-sm leading-tight ${
              section.completed ? "text-teal" : "text-primary"
            }`}
          >
            {section.title}
          </span>
        </div>
        <span className="text-secondary shrink-0 text-sm">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <div className="pl-9">
                <p className="text-secondary text-sm leading-relaxed mb-4">
                  {section.content}
                </p>

                <button
                  onClick={() => onToggle(section.id, !section.completed)}
                  disabled={updating}
                  className={`flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-60 ${
                    section.completed
                      ? "bg-teal/15 text-teal hover:bg-teal/25"
                      : "bg-border text-secondary hover:bg-teal/10 hover:text-teal"
                  }`}
                >
                  {updating ? (
                    <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  ) : (
                    <span>{section.completed ? "✓" : "○"}</span>
                  )}
                  {section.completed ? "Изучено" : "Отметить как изученное"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
