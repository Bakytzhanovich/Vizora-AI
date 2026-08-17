"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { DocumentItem } from "@/lib/api";
import { DocumentCard } from "./DocumentCard";
import { DocumentProgress } from "./DocumentProgress";

interface Props {
  checklist: DocumentItem[];
  progress: number;
  onToggle: (id: string, completed: boolean) => void;
  updating: string | null;
}

export function DocumentChecklist({ checklist, progress, onToggle, updating }: Props) {
  const { t } = useTranslation("documents");
  const CATEGORIES: { id: string; label: string; icon: string }[] = [
    { id: "identity", label: t("categories.identity"), icon: "🪪" },
    { id: "program", label: t("categories.program"), icon: "📋" },
    { id: "fees", label: t("categories.fees"), icon: "💰" },
    { id: "education", label: t("categories.education"), icon: "🎓" },
    { id: "financial", label: t("categories.financial"), icon: "💳" },
    { id: "preparation", label: t("categories.preparation"), icon: "🧠" },
    { id: "visa", label: t("categories.visa"), icon: "🔖" },
  ];
  const requiredDocs = checklist.filter((d) => d.required);
  const completedCount = requiredDocs.filter((d) => d.completed).length;
  const allRequiredDone = requiredDocs.every((d) => d.completed);

  return (
    <div>
      <DocumentProgress
        completed={completedCount}
        total={requiredDocs.length}
        progress={progress}
      />

      {CATEGORIES.map((cat) => {
        const docs = checklist.filter((d) => d.category === cat.id);
        if (!docs.length) return null;
        return (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6"
          >
            <h3 className="text-secondary text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>{cat.icon}</span>
              {cat.label}
            </h3>
            <div className="space-y-2">
              {docs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onToggle={onToggle}
                  disabled={updating === doc.id}
                />
              ))}
            </div>
          </motion.div>
        );
      })}

      {/* Sticky CTA */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-bg to-transparent mt-4">
        <button
          disabled={!allRequiredDone}
          className={`w-full py-4 rounded-2xl font-bold text-sm transition-all shadow-lg ${
            allRequiredDone
              ? "bg-teal text-bg shadow-teal/20 hover:bg-[#00E5B8]"
              : "bg-card border border-border text-secondary cursor-not-allowed"
          }`}
        >
          {allRequiredDone
            ? t("all_ready_button")
            : t("remaining_button", { n: requiredDocs.length - completedCount })}
        </button>
      </div>
    </div>
  );
}
