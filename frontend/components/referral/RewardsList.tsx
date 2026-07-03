"use client";

import type { ReferralReward, ReferralTier } from "@/lib/api";

interface RewardsListProps {
  earned: ReferralReward[];
  pending: ReferralTier[];
}

export function RewardsList({ earned, pending }: RewardsListProps) {
  if (earned.length === 0 && pending.length === 0) return null;

  return (
    <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5">
      <h3 className="text-[#F0F0FF] font-semibold text-sm mb-3">Твои награды</h3>
      <div className="flex flex-col gap-2">
        {earned.map((r) => (
          <div
            key={r.reward_type}
            className="flex items-center gap-3 bg-[#F59E0B]/08 border border-[#F59E0B]/20 rounded-xl px-3 py-2.5"
          >
            <span className="text-[#F59E0B] text-lg shrink-0">✅</span>
            <div className="flex-1 min-w-0">
              <p className="text-[#F0F0FF] text-sm font-medium leading-tight">{r.description}</p>
              <p className="text-[#F59E0B] text-xs mt-0.5">Получено</p>
            </div>
          </div>
        ))}
        {pending.map((t) => (
          <div
            key={t.reward_type}
            className="flex items-center gap-3 border border-[#1E1E2E] rounded-xl px-3 py-2.5 opacity-60"
          >
            <span className="text-[#8B8BA7] text-lg shrink-0">⬜</span>
            <div className="flex-1 min-w-0">
              <p className="text-[#8B8BA7] text-sm leading-tight">{t.reward}</p>
              <p className="text-[#8B8BA7]/60 text-xs mt-0.5">
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
