"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { VoiceButton, VoiceState } from "@/components/simulator/VoiceButton";
import { VoiceRecorder } from "@/lib/voice";
import type { LevelResult } from "./LevelResultScreen";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Long enough to hear the closing line before the results replace the chat.
const OUTRO_MIN_DISPLAY_MS = 1500;

interface Message {
  id: string;
  role: "tester" | "student";
  content: string;
}

interface Props {
  testId: string;
  openingMessage: string;
  maxQuestions: number;
  onDone: (result: LevelResult) => void;
  onBack: () => void;
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

export function LevelTestScreen({ testId, openingMessage, maxQuestions, onDone, onBack }: Props) {
  const { t } = useTranslation("simulator");
  const [messages, setMessages] = useState<Message[]>([{ id: makeId(), role: "tester", content: openingMessage }]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isWaiting, setIsWaiting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [hasMic, setHasMic] = useState(true);
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const recorderRef = useRef(new VoiceRecorder());
  const recordStartRef = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const recorder = recorderRef.current;
    return () => recorder.cleanup();
  }, []);

  const playTTS = useCallback(async (text: string) => {
    if (!audioEnabled) return;
    setIsPlaying(true);
    try {
      const res = await fetch(`${API_URL}/api/simulator/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        // The friendly trainer voice — this is a chat, not the consul.
        body: JSON.stringify({ text, mode: "trainer" }),
      });
      if (!res.ok) throw new Error("tts_api");
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      await new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = "en-US";
          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          window.speechSynthesis.speak(utterance);
        });
      }
    } finally {
      setIsPlaying(false);
    }
  }, [audioEnabled]);

  useEffect(() => {
    playTTS(openingMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // the opening is spoken once on mount

  const submitAnswer = useCallback(async (text: string, durationSeconds: number | null) => {
    setError(null);
    setMessages((prev) => [...prev, { id: makeId(), role: "student", content: text }]);
    setIsWaiting(true);
    try {
      const res = await fetch(`${API_URL}/api/level-test/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ test_id: testId, answer: text, duration_seconds: durationSeconds }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages((prev) => [...prev, { id: makeId(), role: "tester", content: data.message }]);
      setIsWaiting(false);

      if (data.done) {
        setIsFinishing(true);
        await Promise.all([playTTS(data.message), new Promise((r) => setTimeout(r, OUTRO_MIN_DISPLAY_MS))]);
        onDone(data.result);
        return;
      }
      setQuestionNumber(data.question_number);
      await playTTS(data.message);
    } catch {
      // The answer wasn't recorded server-side — take the bubble back so the
      // student can simply answer again.
      setMessages((prev) => prev.slice(0, -1));
      setError(t("level_test.error"));
      setIsWaiting(false);
    } finally {
      setVoiceState("idle");
    }
  }, [testId, playTTS, onDone, t]);

  const handleMicClick = useCallback(async () => {
    if (voiceState === "idle") {
      try {
        await recorderRef.current.startRecording();
        recordStartRef.current = Date.now();
        setVoiceState("recording");
      } catch {
        setHasMic(false);
      }
      return;
    }
    if (voiceState !== "recording") return;

    setVoiceState("processing");
    const durationSeconds = (Date.now() - recordStartRef.current) / 1000;
    const blob = await recorderRef.current.stopRecording();
    const form = new FormData();
    form.append("audio", blob, `recording.${blob.type.includes("mp4") ? "mp4" : "webm"}`);

    try {
      const res = await fetch(`${API_URL}/api/simulator/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      const data = await res.json();
      const text: string = data.text || "";
      if (text) {
        await submitAnswer(text, durationSeconds);
      } else {
        setError(t("level_test.not_heard"));
        setVoiceState("idle");
      }
    } catch {
      setError(t("level_test.not_heard"));
      setVoiceState("idle");
    }
  }, [voiceState, submitAnswer, t]);

  const handleTextSubmit = async () => {
    const text = textInput.trim();
    if (!text) return;
    setTextInput("");
    await submitAnswer(text, null);
  };

  const isBusy = isWaiting || isPlaying || isFinishing || voiceState === "processing";

  return (
    <div className="flex flex-col h-screen bg-bg">
      <div className="shrink-0 bg-bg/90 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-secondary hover:text-primary transition-colors">
              <ArrowLeft size={20} />
            </button>
            <span className="text-primary font-semibold text-sm">🎯 {t("level_test.title")}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-secondary text-xs tabular-nums">
              {t("level_test.question_of", { n: questionNumber, max: maxQuestions })}
            </span>
            <button
              onClick={() => setAudioEnabled((v) => !v)}
              className="text-secondary hover:text-primary transition-colors"
            >
              {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-2 h-1 rounded-full bg-border overflow-hidden">
          <motion.div
            className="h-full bg-accent"
            animate={{ width: `${Math.min(100, ((questionNumber - 1) / maxQuestions) * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex mb-3 ${m.role === "tester" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "tester"
                    ? "bg-card border border-border text-primary rounded-2xl rounded-tl-sm"
                    : "bg-accent text-white rounded-2xl rounded-tr-sm"
                }`}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
          {isWaiting && (
            <div className="flex mb-3">
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-2.5 text-secondary text-sm animate-pulse">
                …
              </div>
            </div>
          )}
          {isFinishing && (
            <p className="text-secondary text-xs text-center mt-4 animate-pulse">{t("level_test.calculating")}</p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-bg px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {error && <p className="text-error text-xs text-center mb-2">{error}</p>}
          {hasMic ? (
            <div className="flex flex-col items-center gap-2">
              <VoiceButton state={voiceState} onClick={handleMicClick} disabled={isBusy && voiceState === "idle"} />
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
