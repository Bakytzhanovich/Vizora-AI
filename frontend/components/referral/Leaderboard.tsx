"use client";

import { motion } from "framer-motion";
import type { LeaderboardEntry } from "@/lib/api";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({ entries }: LeaderboardProps) {
  if (entries.length === 0) return null;

  return (
    <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5">
      <h3 className="text-[#F0F0FF] font-semibold text-sm mb-3">Топ амбассадоры</h3>
      <div className="flex flex-col gap-2">
        {entries.map((entry, i) => (
          <motion.div
            key={entry.rank}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
              entry.is_me
                ? "bg-[#6C63FF]/10 border border-[#6C63FF]/20"
                : "border border-[#1E1E2E]"
            }`}
          >
            <span className="text-lg shrink-0 w-6 text-center">
              {MEDALS[i] ?? `#${entry.rank}`}
            </span>
            <span
              className={`flex-1 text-sm font-medium ${
                entry.is_me ? "text-[#6C63FF]" : "text-[#F0F0FF]"
              }`}
            >
              {entry.is_me ? `Ты! (${entry.name})` : entry.name}
            </span>
            <span className="text-[#8B8BA7] text-sm">
              {entry.count}{" "}
              {entry.count === 1 ? "друг" : entry.count < 5 ? "друга" : "друзей"}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
