"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { RoadmapProgress } from "@/components/roadmap/RoadmapProgress";
import { RoadmapStep } from "@/components/roadmap/RoadmapStep";
import { MilestoneStep } from "@/components/roadmap/MilestoneStep";
import { CategoryLabel } from "@/components/roadmap/CategoryLabel";
import { apiGetRoadmap, apiUpdateRoadmapStep } from "@/lib/api";
import type { RoadmapStepData } from "@/lib/api";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";

const MILESTONE_STEP_IDS = new Set(["visa", "arrival", "return"]);

const CATEGORIES: { id: string; icon: string; label: string }[] = [
  { id: "preparation", icon: "📋", label: "Подготовка" },
  { id: "visa", icon: "🛂", label: "Виза" },
  { id: "interview", icon: "🎤", label: "Интервью" },
  { id: "travel", icon: "✈️", label: "Поездка" },
  { id: "usa", icon: "🇺🇸", label: "В США" },
  { id: "return", icon: "🏠", label: "Возвращение" },
];

// Simple emoji confetti burst
function Confetti({ onDone }: { onDone: () => void }) {
  const emojis = ["🎉", "🎊", "✨", "🌟", "🎈", "🥂", "🍾", "🏆"];
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl select-none"
          style={{ left: `${Math.random() * 100}%` }}
          initial={{ y: "110vh", opacity: 1, rotate: 0 }}
          animate={{ y: "-10vh", opacity: [1, 1, 0], rotate: Math.random() * 720 - 360 }}
          transition={{
            duration: 2 + Math.random() * 1,
            delay: Math.random() * 0.8,
            ease: "easeOut",
          }}
        >
          {emojis[Math.floor(Math.random() * emojis.length)]}
        </motion.div>
      ))}
    </div>
  );
}

export default function RoadmapPage() {
  const router = useRouter();
  const [steps, setSteps] = useState<RoadmapStepData[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const currentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }
    apiGetRoadmap()
      .then(({ steps, progress }) => {
        setSteps(steps);
        setProgress(progress);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [router]);

  // Auto-scroll to current step once loaded
  useEffect(() => {
    if (!loading && currentRef.current) {
      setTimeout(() => {
        currentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
    }
  }, [loading]);

  const handleMarkComplete = useCallback(async (stepId: string) => {
    setUpdating(stepId);

    // Optimistic update
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === stepId);
      if (idx === -1) return prev;
      const updated = prev.map((s, i) => {
        if (i === idx) return { ...s, status: "completed" as const, completed_at: new Date().toISOString() };
        if (i === idx + 1 && s.status === "pending") return { ...s, status: "in_progress" as const };
        return s;
      });
      return updated;
    });

    if (stepId === "visa") setShowConfetti(true);

    try {
      const { next_step } = await apiUpdateRoadmapStep(stepId, "completed");

      // Refresh from server to get accurate state
      const fresh = await apiGetRoadmap();
      setSteps(fresh.steps);
      setProgress(fresh.progress);

      // Scroll to new current step
      if (next_step) {
        setTimeout(() => {
          currentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }
    } catch {
      // Revert optimistic update
      const fresh = await apiGetRoadmap().catch(() => null);
      if (fresh) {
        setSteps(fresh.steps);
        setProgress(fresh.progress);
      }
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
        <p className="text-[#FF6B6B] text-sm">Не удалось загрузить roadmap</p>
        <button onClick={() => router.push("/dashboard")} className="text-[#6C63FF] text-sm underline">
          Вернуться на главную
        </button>
      </div>
    );
  }

  const currentStep = steps.find((s) => s.status === "in_progress");
  const currentStepNumber = currentStep?.number ?? steps.length;
  const totalSteps = steps.length;

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <PoweredByFooter />
      <AnimatePresence>
        {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur border-b border-[#1E1E2E]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-[#8B8BA7] hover:text-[#F0F0FF] transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <span className="text-[#F0F0FF] font-bold">Roadmap</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <RoadmapProgress
          currentStepNumber={currentStepNumber}
          totalSteps={totalSteps}
          progress={progress}
        />

        {CATEGORIES.map((cat) => {
          const catSteps = steps.filter((s) => s.category === cat.id);
          if (!catSteps.length) return null;

          return (
            <div key={cat.id}>
              <CategoryLabel icon={cat.icon} label={cat.label} />

              {catSteps.map((step, idx) => {
                const isLast =
                  idx === catSteps.length - 1 &&
                  cat.id === CATEGORIES[CATEGORIES.length - 1].id;
                const isCurrentStep = step.status === "in_progress";
                const ref = isCurrentStep ? currentRef : null;

                const commonProps = {
                  step,
                  isLast,
                  onMarkComplete: handleMarkComplete,
                  updating: updating === step.id,
                  ref,
                };

                return MILESTONE_STEP_IDS.has(step.id) ? (
                  <MilestoneStep key={step.id} {...commonProps} />
                ) : (
                  <RoadmapStep key={step.id} {...commonProps} />
                );
              })}
            </div>
          );
        })}

        {/* All done celebration */}
        {steps.every((s) => s.status === "completed") && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-8 bg-gradient-to-r from-[#6C63FF]/20 to-[#00D4AA]/20 border border-[#6C63FF]/30 rounded-2xl p-6 text-center"
          >
            <div className="text-4xl mb-3">🏆</div>
            <h2 className="text-[#F0F0FF] font-bold text-lg mb-1">Программа завершена!</h2>
            <p className="text-[#8B8BA7] text-sm">
              Ты прошёл весь путь Work &amp; Travel USA. Поздравляем!
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
