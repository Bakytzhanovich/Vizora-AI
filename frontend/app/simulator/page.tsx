"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { ModeSelector } from "@/components/simulator/ModeSelector";
import { InterviewScreen } from "@/components/simulator/InterviewScreen";
import { ResultsScreen, FeedbackData } from "@/components/simulator/ResultsScreen";
import { SessionsLimitOverlay } from "@/components/simulator/SessionsLimitOverlay";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

const PLAN_LABELS: Record<string, string> = {
  free: "Бесплатный",
  standard: "Стандарт",
  premium: "Премиум",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Step = "mode_select" | "interview" | "results";

interface SessionData {
  sessionId: string;
  openingQuestion: string;
  mode: "trainer" | "consul";
  difficulty: string;
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
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sessionsLimitHit, setSessionsLimitHit] = useState(false);

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
  }, [router]);

  const handleStart = async (mode: "trainer" | "consul", difficulty: string) => {
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
            planLabel={PLAN_LABELS[subscription.plan] ?? subscription.plan}
            sessionsUsed={subscription.sessions_used ?? subscription.sessions_limit}
            sessionsLimit={subscription.sessions_limit}
            neverResets={subscription.limits.simulator_sessions_total != null}
            onWait={() => setSessionsLimitHit(false)}
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
        onEnd={handleSessionEnd}
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
