"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

type Mode = "trainer" | "consul";
type Difficulty = "easy" | "medium" | "hard";

interface Props {
  onStart: (mode: Mode, difficulty: Difficulty) => void;
  isLoading: boolean;
}

export function ModeSelector({ onStart, isLoading }: Props) {
  const { t } = useTranslation("simulator");
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const difficulties: { value: Difficulty; label: string; emoji: string }[] = [
    { value: "easy", label: t("difficulty.easy"), emoji: "🟢" },
    { value: "medium", label: t("difficulty.medium"), emoji: "🟡" },
    { value: "hard", label: t("difficulty.hard"), emoji: "🔴" },
  ];

  const trainerFeatures = t("trainer.features", { returnObjects: true }) as string[];
  const consulFeatures = t("consul.features", { returnObjects: true }) as string[];

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎤</div>
          <h1 className="text-2xl font-bold text-[#F0F0FF] mb-2">{t("title")}</h1>
          <p className="text-[#8B8BA7]">{t("subtitle")}</p>
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
            <h2 className="text-[#F0F0FF] font-bold mb-1">{t("trainer.title")}</h2>
            <p className="text-[#8B8BA7] text-xs mb-4">{t("trainer.desc")}</p>
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
              {t("trainer.button")}
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
            <h2 className="text-[#F0F0FF] font-bold mb-1">{t("consul.title")}</h2>
            <p className="text-[#8B8BA7] text-xs mb-4">{t("consul.desc")}</p>
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
              {t("consul.button")}
            </button>
          </motion.div>
        </div>

        {/* Difficulty */}
        <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-4 mb-6">
          <p className="text-[#8B8BA7] text-xs mb-3">{t("difficulty.label")}</p>
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
          {isLoading
            ? t("start_button.starting")
            : selectedMode
            ? t(selectedMode === "trainer" ? "start_button.start_trainer" : "start_button.start_consul")
            : t("start_button.select_first")}
        </motion.button>
      </motion.div>
    </div>
  );
}
