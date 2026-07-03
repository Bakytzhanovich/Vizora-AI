"use client";

import { motion } from "framer-motion";

const QUICK_QUESTIONS = [
  "Что такое DS-160?",
  "Какие документы на интервью?",
  "Почему отказывают в визе?",
  "Что такое SEVIS?",
  "Как вернуть налоги?",
  "Можно работать на второй работе?",
];

interface Props {
  onSelect: (question: string) => void;
}

export function QuickQuestions({ onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {QUICK_QUESTIONS.map((q, i) => (
        <motion.button
          key={q}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 + i * 0.05 }}
          onClick={() => onSelect(q)}
          className="text-sm text-[#8B8BA7] border border-[#1E1E2E] rounded-full px-4 py-2 hover:border-[#6C63FF] hover:text-[#F0F0FF] hover:bg-[#6C63FF]/5 transition-all duration-200 cursor-pointer"
        >
          {q}
        </motion.button>
      ))}
    </div>
  );
}
