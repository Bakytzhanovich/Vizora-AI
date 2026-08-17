"use client";

import type { ReferralReward, ReferralTier } from "@/lib/api";

interface RewardsListProps {
  earned: ReferralReward[];
  pending: ReferralTier[];
}

export function RewardsList({ earned, pending }: RewardsListProps) {
  if (earned.length === 0 && pending.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="text-primary font-semibold text-sm mb-3">Твои награды</h3>
      <div className="flex flex-col gap-2">
        {earned.map((r) => (
          <div
            key={r.reward_type}
            className="flex items-center gap-3 bg-warning/08 border border-warning/20 rounded-xl px-3 py-2.5"
          >
            <span className="text-warning text-lg shrink-0">✅</span>
            <div className="flex-1 min-w-0">
              <p className="text-primary text-sm font-medium leading-tight">{r.description}</p>
              <p className="text-warning text-xs mt-0.5">Получено</p>
            </div>
          </div>
        ))}
        {pending.map((t) => (
          <div
            key={t.reward_type}
            className="flex items-center gap-3 border border-border rounded-xl px-3 py-2.5 opacity-60"
          >
            <span className="text-secondary text-lg shrink-0">⬜</span>
            <div className="flex-1 min-w-0">
              <p className="text-secondary text-sm leading-tight">{t.reward}</p>
              <p className="text-secondary/60 text-xs mt-0.5">
                Нужно {t.referrals_needed}{" "}
                {t.referrals_needed === 1 ? "друга" : "друзей"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
