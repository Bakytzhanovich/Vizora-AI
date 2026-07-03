"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

import { SectionContent } from "@/components/after-visa/SectionContent";
import { ProgressBadge } from "@/components/after-visa/ProgressBadge";
import {
  apiGetAfterVisaContent,
  apiUpdateAfterVisaProgress,
  type AfterVisaModuleDetail,
  type AfterVisaSection,
} from "@/lib/api";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";

const CHAT_LINKS: Record<string, string> = {
  ssn: "Спросить AI про SSN →",
  taxes: "Спросить AI про налоги →",
  banking: "Спросить AI про банковский счёт →",
};

export default function AfterVisaModulePage() {
  const router = useRouter();
  const params = useParams();
  const moduleId = params.module_id as string;

  const [module, setModule] = useState<AfterVisaModuleDetail | null>(null);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const [pct, setPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }
    apiGetAfterVisaContent(moduleId)
      .then((data) => {
        setModule(data.module);
        setCompleted(data.completed);
        setTotal(data.total);
        setPct(data.pct);
      })
      .catch(() => router.push("/after-visa"))
      .finally(() => setLoading(false));
  }, [moduleId, router]);

  const handleToggle = useCallback(
    async (sectionId: string, newCompleted: boolean) => {
      if (!module) return;
      setUpdating(sectionId);

      // Optimistic update
      setModule((prev) =>
        prev
          ? {
              ...prev,
              sections: prev.sections.map((s) =>
                s.id === sectionId ? { ...s, completed: newCompleted } : s
              ),
            }
          : null
      );

      try {
        const res = await apiUpdateAfterVisaProgress(moduleId, sectionId, newCompleted);
        // Recompute local progress
        setModule((prev) => {
          if (!prev) return null;
          const done = prev.sections.filter((s) =>
            s.id === sectionId ? newCompleted : s.completed
          ).length;
          setCompleted(done);
          setPct(prev.sections.length > 0 ? Math.round((done / prev.sections.length) * 100) : 0);
          return prev;
        });
        // overall_progress is for the whole after-visa module set — just discard here
        void res.overall_progress;
      } catch {
        // Revert
        setModule((prev) =>
          prev
            ? {
                ...prev,
                sections: prev.sections.map((s) =>
                  s.id === sectionId ? { ...s, completed: !newCompleted } : s
                ),
              }
            : null
        );
      } finally {
        setUpdating(null);
      }
    },
    [module, moduleId]
  );

  const allModuleIds = [
    "trip_prep", "arrival", "ssn", "banking",
    "second_job", "taxes", "return_home",
  ];
  const currentIdx = allModuleIds.indexOf(moduleId);
  const prevId = currentIdx > 0 ? allModuleIds[currentIdx - 1] : null;
  const nextId = currentIdx < allModuleIds.length - 1 ? allModuleIds[currentIdx + 1] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin" />
      </div>
    );
  }

  if (!module) return null;

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <PoweredByFooter />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur border-b border-[#1E1E2E]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.push("/after-visa")}
              className="text-[#8B8BA7] hover:text-[#F0F0FF] transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xl">{module.icon}</span>
              <span className="text-[#F0F0FF] font-bold">{module.title}</span>
            </div>
          </div>
          <div className="px-1">
            <ProgressBadge completed={completed} total={total} pct={pct} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[#8B8BA7] text-sm mb-5"
        >
          {module.description}
        </motion.p>

        {/* Sections */}
        <div className="flex flex-col gap-3 mb-8">
          {module.sections.map((section: AfterVisaSection, i: number) => (
            <SectionContent
              key={section.id}
              section={section}
              index={i}
              moduleId={moduleId}
              onToggle={handleToggle}
              updating={updating === section.id}
            />
          ))}
        </div>

        {/* AI link for relevant modules */}
        {CHAT_LINKS[moduleId] && (
          <div className="mb-6">
            <button
              onClick={() => router.push("/chat")}
              className="w-full py-3.5 rounded-xl border border-[#6C63FF]/30 text-[#6C63FF] text-sm font-semibold hover:bg-[#6C63FF]/10 transition-colors"
            >
              🤖 {CHAT_LINKS[moduleId]}
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          {prevId ? (
            <button
              onClick={() => router.push(`/after-visa/${prevId}`)}
              className="flex-1 py-3.5 rounded-xl border border-[#1E1E2E] text-[#8B8BA7] text-sm font-medium hover:border-[#00D4AA]/30 hover:text-[#F0F0FF] transition-colors"
            >
              ← Предыдущий
            </button>
          ) : (
            <div className="flex-1" />
          )}
          {nextId ? (
            <button
              onClick={() => router.push(`/after-visa/${nextId}`)}
              className="flex-1 py-3.5 rounded-xl bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] text-sm font-semibold hover:bg-[#00D4AA]/20 transition-colors"
            >
              Следующий →
            </button>
          ) : (
            <button
              onClick={() => router.push("/after-visa")}
              className="flex-1 py-3.5 rounded-xl bg-[#00D4AA] text-[#0A0A0F] text-sm font-bold hover:bg-[#00B894] transition-colors"
            >
              Готово ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
