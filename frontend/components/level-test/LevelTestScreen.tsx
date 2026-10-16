"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, GraduationCap, SendHorizontal, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { VoiceButton, VoiceState } from "@/components/simulator/VoiceButton";
import { VoiceRecorder } from "@/lib/voice";
import type { LevelResult } from "./LevelResultScreen";

const API_URL = ""; // same origin — next.config.mjs proxies /api to the backend

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

type Confirm = "exit" | "finish" | null;

function makeId() {
  return Math.random().toString(36).slice(2);
}

function TesterAvatar() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
      <GraduationCap size={17} />
    </span>
  );
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
  const [confirm, setConfirm] = useState<Confirm>(null);

  const recorderRef = useRef(new VoiceRecorder());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordStartRef = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const stopSpeech = () => {
    audioRef.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  useEffect(() => {
    const recorder = recorderRef.current;
    return () => {
      recorder.cleanup();
      stopSpeech();
    };
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
      audioRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        // stopSpeech() pauses rather than ends, so the student can cut the
        // tester off and answer.
        audio.onpause = () => resolve();
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

  // `speech` is what /level-test/transcribe measured — the backend judges
  // fluency from it. Null for typed answers.
  const submitAnswer = useCallback(async (text: string, durationSeconds: number | null, speech: unknown = null) => {
    setError(null);
    setMessages((prev) => [...prev, { id: makeId(), role: "student", content: text }]);
    setIsWaiting(true);
    try {
      const res = await fetch(`${API_URL}/api/level-test/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ test_id: testId, answer: text, duration_seconds: durationSeconds, speech }),
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
      stopSpeech();
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
      const res = await fetch(`${API_URL}/api/level-test/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      // 400 is a too-short recording; anything else is the server or the
      // speech provider, which "didn't hear you" would misreport.
      if (!res.ok) {
        console.error("level-test transcribe failed", res.status);
        setError(t(res.status === 400 ? "level_test.not_heard" : "level_test.error"));
        setVoiceState("idle");
        return;
      }
      const data = await res.json();
      const text: string = data.text || "";
      if (text) {
        await submitAnswer(text, durationSeconds, data.speech ?? null);
      } else {
        setError(t("level_test.not_heard"));
        setVoiceState("idle");
      }
    } catch {
      setError(t("level_test.error"));
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
  const answered = messages.filter((m) => m.role === "student").length;
  // Finishing mid-answer would drop the answer being recorded or scored.
  const canFinish = answered > 0 && !isWaiting && !isFinishing && voiceState === "idle";

  const handleExit = () => {
    if (answered === 0) return onBack();
    setConfirm("exit");
  };

  const handleFinish = async () => {
    setConfirm(null);
    setError(null);
    setIsFinishing(true);
    stopSpeech();
    try {
      const res = await fetch(`${API_URL}/api/level-test/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ test_id: testId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      onDone(data.result);
    } catch {
      setError(t("level_test.finish_error"));
      setIsFinishing(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-bg">
      {confirm && (
        <div
          className="fixed inset-0 z-50 bg-bg/90 backdrop-blur flex items-center justify-center px-4"
          onClick={() => setConfirm(null)}
        >
          <div
            className="w-full max-w-sm bg-card border border-border rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-primary font-semibold mb-2">
              {t(confirm === "exit" ? "level_test.confirm_exit_title" : "level_test.confirm_finish_title")}
            </h2>
            <p className="text-secondary text-sm leading-relaxed mb-5">
              {t(confirm === "exit" ? "level_test.confirm_exit_text" : "level_test.confirm_finish_text")}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleFinish}
                disabled={!canFinish}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-all"
              >
                {t(confirm === "exit" ? "level_test.finish_and_see" : "level_test.finish")}
              </button>
              {confirm === "exit" && (
                <button
                  onClick={onBack}
                  className="w-full text-error border border-error/30 hover:bg-error/10 font-semibold py-3 rounded-xl text-sm transition-all"
                >
                  {t("level_test.exit")}
                </button>
              )}
              <button
                onClick={() => setConfirm(null)}
                className="w-full text-secondary hover:text-primary py-2 text-sm transition-colors"
              >
                {t("level_test.continue")}
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="shrink-0 border-b border-border bg-bg/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto flex h-14 items-center gap-1 px-2">
          <button
            onClick={handleExit}
            disabled={isFinishing}
            aria-label={t("level_test.exit")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-secondary hover:text-primary transition-colors disabled:opacity-50"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-primary text-[15px] font-semibold leading-tight">{t("level_test.short_title")}</p>
            <p className="text-secondary text-xs tabular-nums">
              {t("level_test.question_of", { n: questionNumber, max: maxQuestions })}
            </p>
          </div>
          <button
            onClick={() => setAudioEnabled((v) => !v)}
            aria-label={t(audioEnabled ? "level_test.sound_off" : "level_test.sound_on")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-secondary hover:text-primary transition-colors"
          >
            {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button
            onClick={() => setConfirm("finish")}
            disabled={!canFinish}
            title={answered === 0 ? t("level_test.finish_hint") : undefined}
            className="mr-1 h-9 shrink-0 whitespace-nowrap rounded-lg bg-accent/10 px-3 text-sm font-medium text-accent hover:bg-accent/15 transition-colors disabled:opacity-40 disabled:hover:bg-accent/10"
          >
            {t("level_test.finish")}
          </button>
        </div>
        <div className="max-w-2xl mx-auto flex gap-1 px-4 pb-3">
          {Array.from({ length: maxQuestions }, (_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < questionNumber - 1 ? "bg-accent" : "bg-border"}`}
            />
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-2xl mx-auto">
          {answered === 0 && (
            <div className="mb-5 rounded-2xl border border-border bg-card p-4">
              <p className="text-primary text-sm font-semibold mb-2.5">{t("level_test.how_title")}</p>
              <ul className="space-y-2">
                {(t("level_test.how_items", { returnObjects: true }) as string[]).map((item) => (
                  <li key={item} className="flex gap-2.5 text-secondary text-sm leading-snug">
                    <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "tester" ? (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex gap-2.5">
                <TesterAvatar />
                <div className="min-w-0 max-w-[85%]">
                  <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-primary text-[15px] leading-relaxed">
                    {m.content}
                  </div>
                  {isPlaying && i === messages.length - 1 && (
                    <p className="mt-1.5 flex items-center gap-1.5 pl-1 text-accent text-xs">
                      <Volume2 size={14} className="animate-pulse" />
                      {t("level_test.speaking")}
                    </p>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-accent px-4 py-3 text-white text-[15px] leading-relaxed">
                  {m.content}
                </div>
              </motion.div>
            ),
          )}
          {isWaiting && (
            <div className="mb-4 flex gap-2.5">
              <TesterAvatar />
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-4">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-secondary"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }}
                  />
                ))}
              </div>
            </div>
          )}
          {isFinishing && (
            <p className="text-secondary text-sm text-center mt-4 animate-pulse">{t("level_test.calculating")}</p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card px-4 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto">
          {error && <p className="text-error text-sm text-center mb-3">{error}</p>}
          {hasMic ? (
            <div className="flex flex-col items-center">
              <VoiceButton
                state={voiceState}
                onClick={handleMicClick}
                disabled={(isWaiting || isFinishing) && voiceState === "idle"}
              />
              <button
                onClick={() => setHasMic(false)}
                className="min-h-11 px-3 text-secondary text-sm hover:text-primary transition-colors"
              >
                {t("interview.no_mic")}
              </button>
            </div>
          ) : (
            <div className="flex gap-2 pb-1">
              {/* 16px text: iOS Safari zooms the page into smaller inputs on focus. */}
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isBusy && handleTextSubmit()}
                placeholder={t("interview.type_placeholder")}
                disabled={isBusy}
                className="min-w-0 flex-1 bg-bg border border-border focus:border-accent/50 rounded-xl px-4 py-3 text-primary placeholder-secondary text-base outline-none transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleTextSubmit}
                disabled={isBusy || !textInput.trim()}
                aria-label={t("level_test.send")}
                className="flex w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40"
              >
                <SendHorizontal size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
