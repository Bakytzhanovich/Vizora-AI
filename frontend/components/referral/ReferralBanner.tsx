"use client";

import { motion } from "framer-motion";

interface ReferralBannerProps {
  referrerName: string;
}

export function ReferralBanner({ referrerName }: ReferralBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 bg-gradient-to-r from-accent/15 to-warning/10 border border-accent/30 rounded-xl px-4 py-3"
    >
      <p className="text-primary text-sm font-semibold mb-0.5">
        🎉 Тебя пригласил {referrerName}!
      </p>
      <p className="text-secondary text-xs">
        Зарегистрируйся и пройди онбординг — получишь бесплатную сессию симулятора
      </p>
    </motion.div>
  );
}
