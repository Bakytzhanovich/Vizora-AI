"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

import { ReferralLinkBox } from "@/components/referral/ReferralLinkBox";
import { RewardProgress } from "@/components/referral/RewardProgress";
import { RewardsList } from "@/components/referral/RewardsList";
import { ReferralStats } from "@/components/referral/ReferralStats";
import { Leaderboard } from "@/components/referral/Leaderboard";
import {
  apiGetReferralCode,
  apiGetReferralLeaderboard,
  type ReferralCodeResponse,
  type LeaderboardEntry,
} from "@/lib/api";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";

const HOW_IT_WORKS = [
  "Поделись своей ссылкой с друзьями",
  "Друг регистрируется и проходит онбординг",
  "Друг получает бесплатную сессию симулятора",
  "Ты получаешь награду за каждого активного друга",
];

export default function ReferralPage() {
  const router = useRouter();
  const [data, setData] = useState<ReferralCodeResponse | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }
    Promise.all([
      apiGetReferralCode(),
      apiGetReferralLeaderboard().catch(() => ({ top_referrers: [] })),
    ])
      .then(([ref, lb]) => {
        setData(ref);
        setBoard(lb.top_referrers);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#6C63FF]/30 border-t-[#6C63FF] rounded-full animate-spin" />
      </div>
    );
  }

  const stats = data?.stats;
  const earnedRewards = stats?.rewards ?? [];
  const pendingTiers = (stats?.tiers ?? []).filter(
    (t) => !earnedRewards.some((r) => r.reward_type === t.reward_type)
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <PoweredByFooter />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur border-b border-[#1E1E2E]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-[#8B8BA7] hover:text-[#F0F0FF] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-[#F0F0FF] font-bold leading-tight">Пригласи друзей</h1>
            <p className="text-[#8B8BA7] text-xs">Получи бонусы за каждого друга</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-6 flex flex-col gap-5">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-[#6C63FF]/10 to-[#F59E0B]/5 border border-[#6C63FF]/20 rounded-2xl p-5"
        >
          <div className="text-3xl mb-2">🎁</div>
          <h2 className="text-[#F0F0FF] font-bold text-lg mb-1">
            Пригласи друзей — получи бонусы
          </h2>
          <p className="text-[#8B8BA7] text-sm leading-relaxed">
            За каждого друга, который пройдёт регистрацию и онбординг, ты получишь награду.
            Твой друг тоже получит бесплатную сессию симулятора!
          </p>
        </motion.div>

        {/* Referral link */}
        {data && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <ReferralLinkBox code={data.code} link={data.link} />
          </motion.div>
        )}

        {/* Stats */}
        {stats && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <ReferralStats
              totalInvited={stats.total_invited}
              totalRegistered={stats.total_registered}
              totalActive={stats.total_active}
            />
          </motion.div>
        )}

        {/* Progress */}
        {stats && stats.tiers.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <RewardProgress
              totalActive={stats.total_active}
              tiers={stats.tiers}
              rewards={earnedRewards}
            />
          </motion.div>
        )}

        {/* Rewards list */}
        {(earnedRewards.length > 0 || pendingTiers.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <RewardsList earned={earnedRewards} pending={pendingTiers} />
          </motion.div>
        )}

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5"
        >
          <h3 className="text-[#F0F0FF] font-semibold text-sm mb-3">Как это работает</h3>
          <div className="flex flex-col gap-2.5">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#6C63FF]/15 text-[#6C63FF] text-[11px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-[#C0C0D8] text-sm">{step}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Leaderboard */}
        {board.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Leaderboard entries={board} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
