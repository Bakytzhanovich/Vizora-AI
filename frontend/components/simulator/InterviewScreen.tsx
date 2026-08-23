"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OfficerCard } from "./OfficerCard";
import { TranscriptItem, TranscriptEntry } from "./TranscriptItem";
import { VoiceButton, VoiceState } from "./VoiceButton";
import { VoiceRecorder } from "@/lib/voice";
import type { FeedbackData } from "./ResultsScreen";
import { TrialSessionEndedModal } from "./TrialSessionEndedModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function makeId() {
  return Math.random().toString(36).slice(2);
}

interface Props {
  mode: "trainer" | "consul";
  difficulty: string;
  sessionId: string;
  openingQuestion: string;
  onEnd: (feedback: FeedbackData) => void;
  onBack: () => void;
}

export function InterviewScreen({ mode, sessionId, openingQuestion, onEnd, onBack }: Props) {
  const { t } = useTranslation("simulator");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([
    { id: makeId(), role: "officer", content: openingQuestion },
  ]);
  const [currentQuestion, setCurrentQuestion] = useState(openingQuestion);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [hasMic, setHasMic] = useState(true);
  const [textInput, setTextInput] = useState("");
  const [timer, setTimer] = useState(0);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [isEnding, setIsEnding] = useState(false);
  const [trialEnded, setTrialEnded] = useState<{ answered: number; total: number } | null>(null);

  const recorderRef = useRef(new VoiceRecorder());
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "");

  useEffect(() => {
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const formatTimer = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const playTTS = useCallback(async (text: string) => {
    if (!audioEnabled) return;

    // Cancel any in-progress browser speech before starting new utterance
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsPlaying(true);
    try {
      const res = await fetch(`${API_URL}/api/simulator/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ text, mode }),
      });

      if (!res.ok) throw new Error("tts_api");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch {
      // API TTS unavailable — fall back to browser speech synthesis so the consul keeps a voice
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = "en-US";
          utterance.rate = 0.85;
          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          window.speechSynthesis.speak(utterance);
        });
      }
    } finally {
      setIsPlaying(false);
    }
  }, [audioEnabled, mode]);

  // Speak the opening question once when the screen mounts
  useEffect(() => {
    playTTS(openingQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once; openingQuestion is stable for the session lifetime

  const submitAnswer = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const studentId = makeId();
    setTranscript((prev) => [...prev, { id: studentId, role: "student", content: text }]);
    setQuestionNumber((n) => n + 1);
    setIsStreaming(true);

    const officerId = makeId();
    setTranscript((prev) => [...prev, { id: officerId, role: "officer", content: "" }]);

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let accumulated = "";

    try {
      const res = await fetch(`${API_URL}/api/simulator/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ session_id: sessionId, student_answer: text, question_number: questionNumber }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          const body = await res.json().catch(() => null);
          if (body?.detail?.error === "trial_session_ended") {
            setTranscript((prev) => prev.filter((m) => m.id !== officerId));
            setTrialEnded({ answered: body.detail.answered, total: body.detail.total });
            setIsStreaming(false);
            return;
          }
        }
        throw new Error(`HTTP ${res.status}`);
      }

      reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const snap = accumulated;
          setTranscript((prev) => prev.map((m) => (m.id === officerId ? { ...m, content: snap } : m)));
        }
      }

      setCurrentQuestion(accumulated);
      setIsStreaming(false);
      setVoiceState("idle");

      if (accumulated) await playTTS(accumulated);
    } catch {
      setTranscript((prev) =>
        prev.map((m) =>
          m.id === officerId ? { ...m, content: "I'm sorry, there was a technical issue." } : m
        )
      );
      setIsStreaming(false);
      setVoiceState("idle");
    } finally {
      reader?.cancel();
    }
  }, [isStreaming, sessionId, questionNumber, playTTS]);

  const handleMicClick = useCallback(async () => {
    if (voiceState === "idle") {
      try {
        await recorderRef.current.startRecording();
        setVoiceState("recording");
      } catch {
        setHasMic(false);
      }
    } else if (voiceState === "recording") {
      setVoiceState("processing");
      const blob = await recorderRef.current.stopRecording();

      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      form.append("audio", blob, `recording.${ext}`);

      try {
        const res = await fetch(`${API_URL}/api/simulator/transcribe`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
          body: form,
        });
        const data = await res.json();
        const text: string = data.text || "";
        if (text) {
          await submitAnswer(text);
        } else {
          setVoiceState("idle");
        }
      } catch {
        setVoiceState("idle");
      }
    }
  }, [voiceState, submitAnswer]);

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    const text = textInput;
    setTextInput("");
    await submitAnswer(text);
  };

  const handleEnd = async () => {
    if (isEnding) return;
    setIsEnding(true);
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current.cleanup();

    try {
      const res = await fetch(`${API_URL}/api/simulator/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ session_id: sessionId, duration_seconds: timer }),
      });
      if (!res.ok) throw new Error(`/simulator/end failed: ${res.status}`);
      const data = await res.json();
      if (!data.feedback) throw new Error("/simulator/end returned no feedback");
      onEnd(data.feedback);
    } catch {
      onEnd({
        scores: { confidence: 5, language: 5, content: 5, overall: 5 },
        strong_points: [],
        weak_points: [t("interview.load_analysis_error")],
        phrases_to_use: [],
        risk_flags: [],
        recommendation: t("interview.retry_session"),
        // Matches compute_verdict(5.0) in simulator_service.py — this is a
        // fixed literal (not a recomputed formula) because the fallback
        // score itself is always exactly 5.0, not a duplicate of the
        // general threshold rule.
        verdict: { score: 50, label: "Почти готов", color: "yellow" },
      });
    }
  };

  const isBusy = isStreaming || voiceState === "processing" || isPlaying;

  if (trialEnded) {
    return (
      <TrialSessionEndedModal
        answered={trialEnded.answered}
        total={trialEnded.total}
        onSeeResults={handleEnd}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg">
      {/* Header */}
      <div className="shrink-0 bg-bg/90 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-secondary hover:text-primary transition-colors">
              <ArrowLeft size={20} />
            </button>
            <span className="text-primary font-semibold text-sm">
              {mode === "consul" ? `🏛️ ${t("consul.title")}` : `🎓 ${t("trainer.title")}`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-accent text-sm font-bold tabular-nums">
              {formatTimer(timer)}
            </span>
            <button
              onClick={() => setAudioEnabled((v) => !v)}
              className="text-secondary hover:text-primary transition-colors"
            >
              {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              onClick={handleEnd}
              disabled={isEnding}
              className="text-xs text-error border border-error/30 px-3 py-1.5 rounded-lg hover:bg-error/10 transition-all disabled:opacity-50"
            >
              {isEnding ? t("interview.analyzing") : t("interview.finish")}
            </button>
          </div>
        </div>
      </div>

      {/* Officer card */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="max-w-2xl mx-auto">
          <OfficerCard
            question={currentQuestion}
            mode={mode}
            isStreaming={isStreaming}
            isPlaying={isPlaying}
          />
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="max-w-2xl mx-auto">
          {transcript.map((entry, i) => (
            <TranscriptItem key={entry.id} entry={entry} index={i} mode={mode} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border bg-bg px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {hasMic ? (
            <div className="flex flex-col items-center gap-2">
              <VoiceButton
                state={voiceState}
                onClick={handleMicClick}
                disabled={isBusy && voiceState === "idle"}
              />
              <button
                onClick={() => setHasMic(false)}
                className="text-secondary text-xs hover:text-primary transition-colors"
              >
                {t("interview.no_mic")}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isBusy && handleTextSubmit()}
                placeholder={t("interview.type_placeholder")}
                disabled={isBusy}
                className="flex-1 bg-card border border-border focus:border-accent/50 rounded-xl px-4 py-3 text-primary placeholder-secondary text-sm outline-none transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleTextSubmit}
                disabled={isBusy || !textInput.trim()}
                className="bg-accent hover:bg-accent-hover disabled:opacity-40 text-white px-4 rounded-xl font-semibold text-sm transition-all"
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
