"use client";

import { motion } from "framer-motion";
import type { ReferralTier, ReferralReward } from "@/lib/api";

interface RewardProgressProps {
  totalActive: number;
  tiers: ReferralTier[];
  rewards: ReferralReward[];
}

const TIER_LABELS: Record<string, string> = {
  simulator_session: "+1 сессия",
  discount: "Скидка 30%",
  unlimited_access: "Месяц доступа",
  lifetime_access: "Навсегда",
};

export function RewardProgress({ totalActive, tiers, rewards }: RewardProgressProps) {
  const earnedTypes = new Set(rewards.map((r) => r.reward_type));
  const maxNeeded = Math.max(...tiers.map((t) => t.referrals_needed));
  const pct = Math.min(100, (totalActive / maxNeeded) * 100);

  const nextTier = tiers.find((t) => !earnedTypes.has(t.reward_type));

  return (
    <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#F0F0FF] font-semibold text-sm">Твой прогресс</h3>
        <span className="text-[#8B8BA7] text-xs">
          {totalActive} {totalActive === 1 ? "друг" : totalActive < 5 ? "друга" : "друзей"}
        </span>
      </div>

      {/* Progress bar with tier markers */}
      <div className="relative mb-6">
        <div className="h-2 bg-[#1E1E2E] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, #6C63FF, #F59E0B)",
            }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>

        {/* Tier markers */}
        {tiers.map((tier) => {
          const pos = (tier.referrals_needed / maxNeeded) * 100;
          const earned = earnedTypes.has(tier.reward_type);
          return (
            <div
              key={tier.reward_type}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${pos}%` }}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 -translate-x-1/2 ${
                  earned
                    ? "bg-[#F59E0B] border-[#F59E0B]"
                    : totalActive >= tier.referrals_needed
                    ? "bg-[#6C63FF] border-[#6C63FF]"
                    : "bg-[#1E1E2E] border-[#8B8BA7]/40"
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Tier labels */}
      <div className="flex justify-between mb-4">
        {tiers.map((tier) => {
          const earned = earnedTypes.has(tier.reward_type);
          return (
            <div key={tier.reward_type} className="flex flex-col items-center gap-0.5">
              <span
                className={`text-[10px] font-bold ${
                  earned ? "text-[#F59E0B]" : "text-[#8B8BA7]"
                }`}
              >
                {tier.referrals_needed}
              </span>
              <span className={`text-[9px] text-center max-w-[52px] leading-tight ${earned ? "text-[#F59E0B]" : "text-[#8B8BA7]/60"}`}>
                {TIER_LABELS[tier.reward_type] ?? tier.reward_type}
              </span>
            </div>
          );
        })}
      </div>

      {/* Next tier callout */}
      {nextTier && (
        <div className="bg-[#6C63FF]/10 border border-[#6C63FF]/20 rounded-xl px-3 py-2">
          <p className="text-[#C0C0D8] text-xs">
            Ещё{" "}
            <span className="text-[#6C63FF] font-bold">
              {Math.max(0, nextTier.referrals_needed - totalActive)} друг
              {nextTier.referrals_needed - totalActive > 1 ? "а" : ""}
            </span>{" "}
            до награды:{" "}
            <span className="text-[#F0F0FF] font-semibold">{nextTier.reward}</span>
          </p>
        </div>
      )}

      {!nextTier && totalActive >= maxNeeded && (
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl px-3 py-2">
          <p className="text-[#F59E0B] text-xs font-bold">
            🏆 Все награды разблокированы — ты Амбассадор!
          </p>
        </div>
      )}
    </div>
  );
}
