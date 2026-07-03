"use client";

import { motion } from "framer-motion";
import type { DocumentItem } from "@/lib/api";
import { DocumentCard } from "./DocumentCard";
import { DocumentProgress } from "./DocumentProgress";

interface Props {
  checklist: DocumentItem[];
  progress: number;
  onToggle: (id: string, completed: boolean) => void;
  updating: string | null;
}

const CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: "identity", label: "Личные документы", icon: "🪪" },
  { id: "program", label: "Документы программы", icon: "📋" },
  { id: "fees", label: "Визовые сборы", icon: "💰" },
  { id: "education", label: "Учёба", icon: "🎓" },
  { id: "financial", label: "Финансовые документы", icon: "💳" },
  { id: "preparation", label: "Подготовка", icon: "🧠" },
  { id: "visa", label: "Документы визы", icon: "🔖" },
];

export function DocumentChecklist({ checklist, progress, onToggle, updating }: Props) {
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
            <h3 className="text-[#8B8BA7] text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
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
      <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-[#0A0A0F] to-transparent mt-4">
        <button
          disabled={!allRequiredDone}
          className={`w-full py-4 rounded-2xl font-bold text-sm transition-all shadow-lg ${
            allRequiredDone
              ? "bg-[#00D4AA] text-[#0A0A0F] shadow-[#00D4AA]/20 hover:bg-[#00E5B8]"
              : "bg-[#13131A] border border-[#1E1E2E] text-[#8B8BA7] cursor-not-allowed"
          }`}
        >
          {allRequiredDone
            ? "🎉 Все документы готовы — удачи на интервью!"
            : `Осталось: ${requiredDocs.length - completedCount} документов`}
        </button>
      </div>
    </div>
  );
}
