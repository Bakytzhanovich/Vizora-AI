"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { OnboardingStep } from "@/components/onboarding/OnboardingStep";
import { Step1 } from "@/components/onboarding/steps/Step1";
import { Step2 } from "@/components/onboarding/steps/Step2";
import { Step3 } from "@/components/onboarding/steps/Step3";
import { Step4 } from "@/components/onboarding/steps/Step4";
import { Step5 } from "@/components/onboarding/steps/Step5";
import { Step6 } from "@/components/onboarding/steps/Step6";
import { Step7 } from "@/components/onboarding/steps/Step7";
import { Step8 } from "@/components/onboarding/steps/Step8";
import { Step9 } from "@/components/onboarding/steps/Step9";
import { Step10 } from "@/components/onboarding/steps/Step10";
import { apiOnboarding } from "@/lib/api";
import { track } from "@/lib/analytics";
import { BrandedLogo } from "@/components/branding/BrandedLogo";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";

const STORAGE_KEY = "vizora_onboarding";
const TOTAL_STEPS = 10;

interface OnboardingData {
  name: string;
  university: string;
  course_year: number | null;
  interview_date: string | null;
  english_level: string;
  travel_history: boolean | null;
  financial_source: string;
  job_offer: string;
  country: string;
  via_agency: boolean | null;
}

const defaultData: OnboardingData = {
  name: "",
  university: "",
  course_year: null,
  interview_date: null,
  english_level: "",
  travel_history: null,
  financial_source: "",
  job_offer: "",
  country: "",
  via_agency: null,
};

type SubmitStatus = "idle" | "loading" | "analyzing" | "done" | "error";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(defaultData);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");

  // Restore from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setData(parsed.data ?? defaultData);
        setStep(parsed.step ?? 1);
      } catch { /* ignore */ }
    }
    // Redirect if not authenticated
    if (!localStorage.getItem("access_token")) {
      router.replace("/login");
    }
  }, [router]);

  // Persist to localStorage on every change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data }));
    }
  }, [step, data]);

  const update = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleFinish = async () => {
    // Prevent double-submit
    if (submitStatus !== "idle" && submitStatus !== "error") return;

    // Guard required nullable fields — send user back to the step to fill them
    const { course_year, travel_history, via_agency } = data;
    if (course_year === null) { setStep(3); return; }
    if (travel_history === null) { setStep(6); return; }
    if (via_agency === null) return;

    setSubmitStatus("loading");
    track("onboarding_start");
    try {
      setSubmitStatus("analyzing");
      await apiOnboarding({
        name: data.name || "Студент",
        university: data.university || "",
        course_year,
        interview_date: data.interview_date,
        english_level: data.english_level || "medium",
        travel_history,
        financial_source: data.financial_source || "self",
        job_offer: data.job_offer || "no",
        country: data.country || "KZ",
        via_agency,
      });
      localStorage.setItem("has_profile", "true");
      localStorage.setItem("user_name", data.name || "");
      localStorage.removeItem(STORAGE_KEY);
      track("onboarding_complete");
      setSubmitStatus("done");
      setTimeout(() => router.push("/dashboard"), 1800);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        // Profile already exists — just go to dashboard
        localStorage.setItem("has_profile", "true");
        localStorage.removeItem(STORAGE_KEY);
        router.push("/dashboard");
        return;
      }
      console.error("Onboarding error:", err);
      setSubmitStatus("error");
    }
  };

  // Analyzing / loading overlay
  if (submitStatus === "analyzing" || submitStatus === "done") {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          {submitStatus === "done" ? (
            <>
              <div className="text-6xl">🎯</div>
              <h2 className="text-2xl font-bold text-[#F0F0FF]">Профиль готов!</h2>
              <p className="text-[#8B8BA7]">Переходим в дашборд...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full border-2 border-[#6C63FF]/30 border-t-[#6C63FF] animate-spin" />
              <h2 className="text-xl font-bold text-[#F0F0FF]">
                Vizora AI анализирует твой профиль...
              </h2>
              <p className="text-[#8B8BA7] text-sm max-w-xs">
                Определяем зоны риска и готовим персональный план подготовки
              </p>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  const stepTitles: Record<number, { title: string; subtitle?: string }> = {
    1: { title: "Как тебя зовут?", subtitle: "Это поможет сделать подготовку персональной" },
    2: { title: "В каком университете ты учишься?" },
    3: { title: "На каком ты курсе?" },
    4: { title: "Когда твоё интервью в консульстве?", subtitle: "Поможем рассчитать план подготовки" },
    5: { title: "Как ты оцениваешь свой английский?" },
    6: { title: "Ты уже выезжал за границу?" },
    7: { title: "Кто финансирует твою поездку?" },
    8: { title: "У тебя уже есть Job Offer?" },
    9: { title: "Из какой ты страны?" },
    10: { title: "Как ты оформляешься на программу?" },
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col">
      <PoweredByFooter />
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/90 backdrop-blur border-b border-[#1E1E2E] px-4 py-4">
        <div className="max-w-lg mx-auto">
          <div className="mb-3">
            <BrandedLogo size="sm" />
          </div>
          <ProgressBar current={step} total={TOTAL_STEPS} />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <OnboardingStep
            stepIndex={step}
            title={stepTitles[step].title}
            subtitle={stepTitles[step].subtitle}
            onBack={goBack}
            canGoBack={step > 1}
          >
            <AnimatePresence mode="wait">
              {step === 1 && (
                <Step1
                  value={data.name}
                  onChange={(v) => update("name", v)}
                  onNext={goNext}
                />
              )}
              {step === 2 && (
                <Step2
                  value={data.university}
                  onChange={(v) => update("university", v)}
                  onNext={goNext}
                />
              )}
              {step === 3 && (
                <Step3
                  value={data.course_year}
                  onChange={(v) => update("course_year", v)}
                  onNext={goNext}
                />
              )}
              {step === 4 && (
                <Step4
                  value={data.interview_date}
                  onChange={(v) => update("interview_date", v)}
                  onNext={goNext}
                />
              )}
              {step === 5 && (
                <Step5
                  value={data.english_level}
                  onChange={(v) => update("english_level", v)}
                  onNext={goNext}
                />
              )}
              {step === 6 && (
                <Step6
                  value={data.travel_history}
                  onChange={(v) => update("travel_history", v)}
                  onNext={goNext}
                />
              )}
              {step === 7 && (
                <Step7
                  value={data.financial_source}
                  onChange={(v) => update("financial_source", v)}
                  onNext={goNext}
                />
              )}
              {step === 8 && (
                <Step8
                  value={data.job_offer}
                  onChange={(v) => update("job_offer", v)}
                  onNext={goNext}
                />
              )}
              {step === 9 && (
                <Step9
                  value={data.country}
                  onChange={(v) => update("country", v)}
                  onNext={goNext}
                />
              )}
              {step === 10 && (
                <Step10
                  value={data.via_agency}
                  onChange={(v) => update("via_agency", v)}
                  onNext={handleFinish}
                />
              )}
            </AnimatePresence>
          </OnboardingStep>

          {submitStatus === "error" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 text-[#FF6B6B] text-sm rounded-xl px-4 py-3 text-center"
            >
              Ошибка при сохранении. Попробуй снова.
              <button
                onClick={() => setSubmitStatus("idle")}
                className="ml-2 underline"
              >
                Повторить
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
