"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

import { DocumentChecklist } from "@/components/documents/DocumentChecklist";
import { DS160Guide } from "@/components/documents/DS160Guide";
import { CommonMistakes } from "@/components/documents/CommonMistakes";
import {
  apiGetChecklist,
  apiGetCommonMistakes,
  apiGetDS160Guide,
  apiUpdateDocument,
  type CommonMistake,
  type DocumentItem,
  type DS160Step,
} from "@/lib/api";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";
import { track } from "@/lib/analytics";

type Tab = "checklist" | "ds160" | "mistakes";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "checklist", label: "Чек-лист", icon: "📋" },
  { id: "ds160", label: "DS-160", icon: "📝" },
  { id: "mistakes", label: "Ошибки", icon: "⚠️" },
];

export default function DocumentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("checklist");

  const [checklist, setChecklist] = useState<DocumentItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [ds160Steps, setDs160Steps] = useState<DS160Step[]>([]);
  const [mistakes, setMistakes] = useState<CommonMistake[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }

    track("documents_viewed");
    Promise.all([apiGetChecklist(), apiGetDS160Guide(), apiGetCommonMistakes()])
      .then(([cl, ds, cm]) => {
        setChecklist(cl.checklist);
        setProgress(cl.progress);
        setDs160Steps(ds.steps);
        setMistakes(cm.mistakes);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [router]);

  const handleToggle = useCallback(async (documentId: string, completed: boolean) => {
    // Optimistic update
    setChecklist((prev) =>
      prev.map((d) => (d.id === documentId ? { ...d, completed } : d))
    );

    setUpdating(documentId);
    try {
      const { progress: newProgress } = await apiUpdateDocument(documentId, completed);
      setProgress(newProgress);
    } catch {
      // Revert optimistic update on failure
      setChecklist((prev) =>
        prev.map((d) => (d.id === documentId ? { ...d, completed: !completed } : d))
      );
    } finally {
      setUpdating(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#6C63FF]/30 border-t-[#6C63FF] rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-[#FF6B6B] text-sm">Не удалось загрузить данные</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-[#6C63FF] text-sm underline"
        >
          Вернуться на главную
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <PoweredByFooter />
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur border-b border-[#1E1E2E]">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center gap-3 py-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-[#8B8BA7] hover:text-[#F0F0FF] transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-[#F0F0FF] font-bold leading-tight">Документы</h1>
              <p className="text-[#8B8BA7] text-xs">Персональный чек-лист и DS-160</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 border-b border-[#1E1E2E] -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-[#6C63FF] text-[#F0F0FF]"
                    : "border-transparent text-[#8B8BA7] hover:text-[#C0C0D0]"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {activeTab === "checklist" && (
            <DocumentChecklist
              checklist={checklist}
              progress={progress}
              onToggle={handleToggle}
              updating={updating}
            />
          )}
          {activeTab === "ds160" && <DS160Guide steps={ds160Steps} />}
          {activeTab === "mistakes" && <CommonMistakes mistakes={mistakes} />}
        </motion.div>
      </div>
    </div>
  );
}
