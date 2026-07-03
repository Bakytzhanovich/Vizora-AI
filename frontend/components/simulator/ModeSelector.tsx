"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Mode = "trainer" | "consul";
type Difficulty = "easy" | "medium" | "hard";

interface Props {
  onStart: (mode: Mode, difficulty: Difficulty) => void;
  isLoading: boolean;
}

const difficulties: { value: Difficulty; label: string; emoji: string }[] = [
  { value: "easy", label: "Лёгкий", emoji: "🟢" },
  { value: "medium", label: "Средний", emoji: "🟡" },
  { value: "hard", label: "Строгий", emoji: "🔴" },
];

const trainerFeatures = [
  "Фидбек после каждого ответа",
  "Подсказки и лучшие формулировки",
  "Объяснение ошибок на русском",
  "Идеально для начинающих",
];

const consulFeatures = [
  "Реальный офицер без подсказок",
  "Follow-up вопросы на слабые ответы",
  "Только английский язык",
  "Финальная проверка готовности",
];

export function ModeSelector({ onStart, isLoading }: Props) {
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎤</div>
          <h1 className="text-2xl font-bold text-[#F0F0FF] mb-2">Симулятор интервью</h1>
          <p className="text-[#8B8BA7]">Выбери режим подготовки</p>
        </div>

        {/* Mode cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {/* Trainer */}
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedMode("trainer")}
            className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 ${
              selectedMode === "trainer"
                ? "border-[#6C63FF] bg-[#6C63FF]/10"
                : "border-[#1E1E2E] bg-[#13131A] hover:border-[#6C63FF]/40"
            }`}
          >
            <div className="text-3xl mb-3">🎓</div>
            <h2 className="text-[#F0F0FF] font-bold mb-1">Режим Тренер</h2>
            <p className="text-[#8B8BA7] text-xs mb-4">Мягкий и обучающий</p>
            <ul className="space-y-1.5 mb-5">
              {trainerFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-[#8B8BA7]">
                  <span className="text-[#00D4AA] shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedMode("trainer"); }}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                selectedMode === "trainer"
                  ? "bg-[#6C63FF] text-white border-[#6C63FF]"
                  : "border-[#6C63FF] text-[#6C63FF] hover:bg-[#6C63FF]/10"
              }`}
            >
              Начать тренировку
            </button>
          </motion.div>

          {/* Consul */}
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedMode("consul")}
            className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 ${
              selectedMode === "consul"
                ? "border-[#6C63FF] bg-[#6C63FF]/10"
                : "border-[#1E1E2E] bg-[#13131A] hover:border-[#6C63FF]/40"
            }`}
          >
            <div className="text-3xl mb-3">🏛️</div>
            <h2 className="text-[#F0F0FF] font-bold mb-1">Режим Консул</h2>
            <p className="text-[#8B8BA7] text-xs mb-4">Строгий и реалистичный</p>
            <ul className="space-y-1.5 mb-5">
              {consulFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-[#8B8BA7]">
                  <span className="text-[#00D4AA] shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedMode("consul"); }}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                selectedMode === "consul"
                  ? "bg-[#6C63FF] text-white"
                  : "bg-[#6C63FF] text-white hover:bg-[#7C75FF]"
              }`}
            >
              Начать интервью
            </button>
          </motion.div>
        </div>

        {/* Difficulty */}
        <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-4 mb-6">
          <p className="text-[#8B8BA7] text-xs mb-3">Уровень сложности</p>
          <div className="flex gap-2">
            {difficulties.map((d) => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                  difficulty === d.value
                    ? "bg-[#6C63FF] text-white"
                    : "bg-[#0A0A0F] text-[#8B8BA7] hover:text-[#F0F0FF]"
                }`}
              >
                {d.emoji} {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Start button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          disabled={!selectedMode || isLoading}
          onClick={() => selectedMode && onStart(selectedMode, difficulty)}
          className="w-full bg-[#6C63FF] hover:bg-[#7C75FF] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all text-base shadow-lg shadow-[#6C63FF]/20"
        >
          {isLoading ? "Запускаем..." : selectedMode ? `Начать (${selectedMode === "trainer" ? "Тренер" : "Консул"})` : "Выбери режим выше"}
        </motion.button>
      </motion.div>
    </div>
  );
}
