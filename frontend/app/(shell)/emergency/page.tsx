"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

import { ScenarioCard } from "@/components/emergency/ScenarioCard";
import { GuidedStep } from "@/components/emergency/GuidedStep";
import { ActionPlan } from "@/components/emergency/ActionPlan";
import {
  apiGetEmergencyScenarios,
  apiStartEmergency,
  apiRespondEmergency,
  apiResolveEmergency,
  type EmergencyScenario,
  type EmergencyStep,
  type EmergencyActionPlan,
} from "@/lib/api";

type FlowStep = "landing" | "guided" | "plan" | "resolved";

interface ActiveSession {
  sessionId: string;
  scenario: EmergencyScenario;
  step: EmergencyStep;
  stepIndex: number;
  totalSteps: number;
}

export default function EmergencyPage() {
  const router = useRouter();
  const { t } = useTranslation("emergency");

  const [flowStep, setFlowStep] = useState<FlowStep>("landing");
  const [scenarios, setScenarios] = useState<EmergencyScenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [actionPlan, setActionPlan] = useState<EmergencyActionPlan | null>(null);
  const [answering, setAnswering] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }
    apiGetEmergencyScenarios()
      .then((d) => setScenarios(d.scenarios))
      .catch(() => {})
      .finally(() => setLoadingScenarios(false));
  }, [router]);

  const handleSelectScenario = useCallback(async (scenarioId: string) => {
    setStartingId(scenarioId);
    try {
      const res = await apiStartEmergency(scenarioId);
      const matched = scenarios.find((s) => s.id === scenarioId);
      if (!matched) return;
      setSession({
        sessionId: res.session_id,
        scenario: matched,
        step: res.step,
        stepIndex: res.step_index,
        totalSteps: res.total_steps,
      });
      setFlowStep("guided");
    } catch {
      // fallback: show error inline instead of breaking
    } finally {
      setStartingId(null);
    }
  }, [scenarios]);

  const handleAnswer = useCallback(async (answer: string) => {
    if (!session || answering) return;
    setSelectedAnswer(answer);
    setAnswering(true);

    try {
      const res = await apiRespondEmergency(session.sessionId, session.stepIndex, answer);

      if (res.completed && res.action_plan) {
        setActionPlan(res.action_plan);
        setFlowStep("plan");
      } else if (res.step) {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                step: res.step!,
                stepIndex: res.step_index,
                totalSteps: res.total_steps,
              }
            : null
        );
        setSelectedAnswer(undefined);
      }
    } catch {
      setSelectedAnswer(undefined);
    } finally {
      setAnswering(false);
    }
  }, [session, answering]);

  const handleResolve = useCallback(async () => {
    if (!session) return;
    setResolving(true);
    try {
      await apiResolveEmergency(session.sessionId);
      setFlowStep("resolved");
    } catch {
      // still show resolved state
      setFlowStep("resolved");
    } finally {
      setResolving(false);
    }
  }, [session]);

  const handleBack = () => {
    if (flowStep === "guided" || flowStep === "plan") {
      setFlowStep("landing");
      setSession(null);
      setActionPlan(null);
      setSelectedAnswer(undefined);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-primary font-bold leading-tight">
              🆘 {t("title")}
            </h1>
            <p className="text-secondary text-xs">{t("subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 lg:pb-6">
        <AnimatePresence mode="wait">
          {/* ── Landing ── */}
          {flowStep === "landing" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Banner */}
              <div className="bg-gradient-to-r from-error/10 to-warning/10 border border-error/20 rounded-2xl p-5 mb-6">
                <div className="text-3xl mb-2">🆘</div>
                <h2 className="text-primary font-bold text-lg mb-1">{t("header")}</h2>
                <p className="text-secondary text-sm leading-relaxed">
                  {t("desc")}
                </p>
              </div>

              {/* Scenario list */}
              {loadingScenarios ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-error/30 border-t-error rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {scenarios.map((scenario, i) => (
                    <ScenarioCard
                      key={scenario.id}
                      scenario={scenario}
                      index={i}
                      onClick={handleSelectScenario}
                      loading={startingId === scenario.id}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Guided Q&A ── */}
          {flowStep === "guided" && session && (
            <motion.div
              key="guided"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <GuidedStep
                step={session.step}
                stepIndex={session.stepIndex}
                totalSteps={session.totalSteps}
                scenarioTitle={session.scenario.title}
                scenarioIcon={session.scenario.icon}
                onAnswer={handleAnswer}
                loading={answering}
                selectedAnswer={selectedAnswer}
              />
            </motion.div>
          )}

          {/* ── Action Plan ── */}
          {flowStep === "plan" && actionPlan && session && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ActionPlan
                plan={actionPlan}
                scenarioTitle={session.scenario.title}
                scenarioIcon={session.scenario.icon}
                onResolve={handleResolve}
                resolving={resolving}
              />
            </motion.div>
          )}

          {/* ── Resolved ── */}
          {flowStep === "resolved" && (
            <motion.div
              key="resolved"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center gap-5 py-12"
            >
              <div className="text-6xl">✅</div>
              <div>
                <h2 className="text-primary font-bold text-xl mb-2">
                  {t("resolved_state.title")}
                </h2>
                <p className="text-secondary text-sm max-w-xs">
                  {t("resolved_state.desc")}
                </p>
              </div>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-accent to-accent-light text-white font-bold text-sm"
              >
                {t("common:common.home")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
