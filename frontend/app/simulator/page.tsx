"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { ModeSelector } from "@/components/simulator/ModeSelector";
import { InterviewScreen } from "@/components/simulator/InterviewScreen";
import { LevelTestScreen } from "@/components/level-test/LevelTestScreen";
import { LevelResultScreen, LevelResult } from "@/components/level-test/LevelResultScreen";
import { ResultsScreen, FeedbackData } from "@/components/simulator/ResultsScreen";
import { SessionsLimitOverlay } from "@/components/simulator/SessionsLimitOverlay";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { apiGetPlans } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Step = "mode_select" | "interview" | "results" | "level_test" | "level_result";

interface LevelTestData {
  testId: string;
  openingMessage: string;
  maxQuestions: number;
}

interface SessionData {
  sessionId: string;
  openingQuestion: string;
  mode: "trainer" | "consul";
  difficulty: string;
  closingPhrases: Record<string, string>;
}

interface HistoryItem {
  id: string;
  mode: string;
  difficulty: string;
  scores: { confidence: number; language: number; content: number; overall: number } | null;
  completed: boolean;
  duration_seconds: number;
  created_at: string;
  question_count: number;
}

export default function SimulatorPage() {
  const router = useRouter();
  const { t } = useTranslation("simulator");
  const { subscription, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>("mode_select");
  const [isStarting, setIsStarting] = useState(false);
  const [session, setSession] = useState<SessionData | null>(null);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [levelTest, setLevelTest] = useState<LevelTestData | null>(null);
  const [levelResult, setLevelResult] = useState<LevelResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sessionsLimitHit, setSessionsLimitHit] = useState(false);
  const [standardPriceKzt, setStandardPriceKzt] = useState<number | null>(null);
  const [premiumPriceKzt, setPremiumPriceKzt] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    fetch(`${API_URL}/api/simulator/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setHistory(d.sessions ?? []))
      .catch(() => {});

    apiGetPlans()
      .then((d) => {
        const standard = d.plans.find((p) => p.id === "standard");
        const premium = d.plans.find((p) => p.id === "premium");
        if (standard) setStandardPriceKzt(standard.prices_kzt.monthly);
        if (premium) setPremiumPriceKzt(premium.prices_kzt.monthly);
      })
      .catch(() => {});
  }, [router]);

  const completedSessions = history.filter((h) => h.completed);
  const totalQuestions = completedSessions.reduce((sum, h) => sum + (h.question_count || 0), 0);
  const scoredSessions = completedSessions.filter((h) => h.scores != null);
  const avgScore = scoredSessions.length > 0
    ? scoredSessions.reduce((sum, h) => sum + (h.scores?.overall ?? 0), 0) / scoredSessions.length
    : null;

  const handleStartLevelTest = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    setIsStarting(true);
    try {
      const res = await fetch(`${API_URL}/api/level-test/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to start level test");
      const data = await res.json();
      setLevelTest({ testId: data.test_id, openingMessage: data.message, maxQuestions: data.max_questions });
      setLevelResult(null);
      track("level_test_start", {});
      setStep("level_test");
    } catch {
      alert(t("start_error"));
    } finally {
      setIsStarting(false);
    }
  };

  const handleStart = async (mode: "trainer" | "consul" | "level_test", difficulty: string) => {
    if (mode === "level_test") return handleStartLevelTest();

    const token = localStorage.getItem("access_token");
    if (!token) return;

    setIsStarting(true);
    try {
      const res = await fetch(`${API_URL}/api/simulator/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode, difficulty }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const reason = body?.detail?.reason;
        if (reason === "sessions_limit") {
          setSessionsLimitHit(true);
          return;
        }
        if (reason === "subscription_required") {
          router.push("/pricing");
          return;
        }
        throw new Error("Failed to start");
      }
      const data = await res.json();

      setSession({
        sessionId: data.session_id,
        openingQuestion: data.opening_question,
        // Absent on a backend that predates the officer-decision flow — the
        // interview then just runs until the student presses "Завершить".
        closingPhrases: data.closing_phrases ?? {},
        mode,
        difficulty,
      });
      track("simulator_start", { mode, difficulty });
      setStep("interview");
      // The server just incremented the session counter — refresh so a
      // later SessionsLimitOverlay in this same visit shows the true count
      // instead of the value cached from page load.
      refreshProfile();
    } catch {
      alert(t("start_error"));
    } finally {
      setIsStarting(false);
    }
  };

  const handleSessionEnd = (fb: FeedbackData) => {
    track("simulator_end", { overall: fb.scores?.overall });
    setFeedback(fb);
    setStep("results");
    // Refresh history
    const token = localStorage.getItem("access_token");
    if (token) {
      fetch(`${API_URL}/api/simulator/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => setHistory(d.sessions ?? []))
        .catch(() => {});
    }
  };

  const handleRetry = () => {
    setSession(null);
    setFeedback(null);
    setStep("mode_select");
  };

  if (step === "mode_select") {
    return (
      <>
        <ModeSelector onStart={handleStart} isLoading={isStarting} />
        <PoweredByFooter />
        {sessionsLimitHit && subscription?.plan && subscription.sessions_limit != null && (
          <SessionsLimitOverlay
            planLabel={
              subscription.plan
                ? t(`plan_names.${subscription.plan}`, { ns: "pricing", defaultValue: subscription.plan })
                : ""
            }
            sessionsUsed={subscription.sessions_used ?? subscription.sessions_limit}
            sessionsLimit={subscription.sessions_limit}
            neverResets={subscription.limits.simulator_sessions_total != null}
            onWait={() => setSessionsLimitHit(false)}
            totalQuestions={totalQuestions}
            avgScore={avgScore}
            standardPriceKzt={standardPriceKzt}
            premiumPriceKzt={premiumPriceKzt}
          />
        )}
      </>
    );
  }

  if (step === "interview" && session) {
    return (
      <InterviewScreen
        mode={session.mode}
        difficulty={session.difficulty}
        sessionId={session.sessionId}
        openingQuestion={session.openingQuestion}
        closingPhrases={session.closingPhrases}
        onEnd={handleSessionEnd}
        onBack={() => setStep("mode_select")}
      />
    );
  }

  if (step === "level_test" && levelTest) {
    return (
      <LevelTestScreen
        key={levelTest.testId}
        testId={levelTest.testId}
        openingMessage={levelTest.openingMessage}
        maxQuestions={levelTest.maxQuestions}
        onDone={(result) => {
          track("level_test_end", { level: result.level });
          setLevelResult(result);
          setStep("level_result");
          // english_level in the profile may have just changed
          refreshProfile();
        }}
        onBack={() => setStep("mode_select")}
      />
    );
  }

  if (step === "level_result" && levelResult) {
    return (
      <LevelResultScreen
        result={levelResult}
        onRetry={handleStartLevelTest}
        onBack={() => setStep("mode_select")}
      />
    );
  }

  if (step === "results" && feedback) {
    return (
      <ResultsScreen
        feedback={feedback}
        history={history}
        onRetry={handleRetry}
      />
    );
  }

  return null;
}
