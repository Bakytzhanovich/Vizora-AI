"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

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

export default function DocumentsPage() {
  const router = useRouter();
  const { t } = useTranslation("documents");
  const [activeTab, setActiveTab] = useState<Tab>("checklist");

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "checklist", label: t("tabs.checklist"), icon: "📋" },
    { id: "ds160", label: t("tabs.ds160"), icon: "📝" },
    { id: "mistakes", label: t("tabs.mistakes"), icon: "⚠️" },
  ];

  const [checklist, setChecklist] = useState<DocumentItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [ds160Steps, setDs160Steps] = useState<DS160Step[]>([]);
  const [ds160Locked, setDs160Locked] = useState(false);
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
    Promise.all([
      apiGetChecklist(),
      apiGetDS160Guide().catch(() => null),
      apiGetCommonMistakes(),
    ])
      .then(([cl, ds, cm]) => {
        setChecklist(cl.checklist);
        setProgress(cl.progress);
        if (ds) {
          setDs160Steps(ds.steps);
        } else {
          setDs160Locked(true);
        }
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
        <p className="text-[#FF6B6B] text-sm">{t("load_error")}</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-[#6C63FF] text-sm underline"
        >
          {t("back_home")}
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
              <h1 className="text-[#F0F0FF] font-bold leading-tight">{t("title")}</h1>
              <p className="text-[#8B8BA7] text-xs">{t("subtitle")}</p>
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
          {activeTab === "ds160" && (
            ds160Locked ? (
              <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-6 text-center">
                <div className="text-3xl mb-3">🔒</div>
                <p className="text-[#F0F0FF] font-semibold text-sm mb-1">{t("ds160_locked_title")}</p>
                <p className="text-[#8B8BA7] text-xs mb-4">{t("ds160_locked_desc")}</p>
                <button
                  onClick={() => router.push("/pricing")}
                  className="bg-[#6C63FF] hover:bg-[#7C75FF] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  {t("ds160_locked_cta")} →
                </button>
              </div>
            ) : (
              <DS160Guide steps={ds160Steps} />
            )
          )}
          {activeTab === "mistakes" && <CommonMistakes mistakes={mistakes} />}
        </motion.div>
      </div>
    </div>
  );
}
