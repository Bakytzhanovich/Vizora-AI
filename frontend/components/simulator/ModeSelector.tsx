"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

type Mode = "trainer" | "consul";
type Difficulty = "easy" | "medium" | "hard";

interface Props {
  onStart: (mode: Mode, difficulty: Difficulty) => void;
  isLoading: boolean;
}

export function ModeSelector({ onStart, isLoading }: Props) {
  const router = useRouter();
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
    <div className="min-h-screen bg-bg px-4 py-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-secondary hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎤</div>
          <h1 className="text-2xl font-bold text-primary mb-2">{t("title")}</h1>
          <p className="text-secondary">{t("subtitle")}</p>
        </div>

        {/* Mode cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {/* Trainer */}
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedMode("trainer")}
            className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 ${
              selectedMode === "trainer"
                ? "border-accent bg-accent/10"
                : "border-border bg-card hover:border-accent/40"
            }`}
          >
            <div className="text-3xl mb-3">🎓</div>
            <h2 className="text-primary font-bold mb-1">{t("trainer.title")}</h2>
            <p className="text-secondary text-xs mb-4">{t("trainer.desc")}</p>
            <ul className="space-y-1.5 mb-5">
              {trainerFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-secondary">
                  <span className="text-teal shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedMode("trainer"); }}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                selectedMode === "trainer"
                  ? "bg-accent text-white border-accent"
                  : "border-accent text-accent hover:bg-accent/10"
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
                ? "border-accent bg-accent/10"
                : "border-border bg-card hover:border-accent/40"
            }`}
          >
            <div className="text-3xl mb-3">🏛️</div>
            <h2 className="text-primary font-bold mb-1">{t("consul.title")}</h2>
            <p className="text-secondary text-xs mb-4">{t("consul.desc")}</p>
            <ul className="space-y-1.5 mb-5">
              {consulFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-secondary">
                  <span className="text-teal shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedMode("consul"); }}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                selectedMode === "consul"
                  ? "bg-accent text-white"
                  : "bg-accent text-white hover:bg-accent-hover"
              }`}
            >
              {t("consul.button")}
            </button>
          </motion.div>
        </div>

        {/* Difficulty */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <p className="text-secondary text-xs mb-3">{t("difficulty.label")}</p>
          <div className="flex gap-2">
            {difficulties.map((d) => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                  difficulty === d.value
                    ? "bg-accent text-white"
                    : "bg-bg text-secondary hover:text-primary"
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
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all text-base shadow-lg shadow-accent/20"
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
