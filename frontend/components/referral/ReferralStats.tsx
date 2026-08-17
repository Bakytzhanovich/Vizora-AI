"use client";

import { motion } from "framer-motion";

interface ReferralStatsProps {
  totalInvited: number;
  totalRegistered: number;
  totalActive: number;
}

export function ReferralStats({ totalInvited, totalRegistered, totalActive }: ReferralStatsProps) {
  const stats = [
    { label: "Приглашено", value: totalInvited, color: "text-accent" },
    { label: "Зарегистрировались", value: totalRegistered, color: "text-warning" },
    { label: "Прошли онбординг", value: totalActive, color: "text-teal" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="bg-card border border-border rounded-xl p-3 text-center"
        >
          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-secondary text-[11px] mt-0.5 leading-tight">{s.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
