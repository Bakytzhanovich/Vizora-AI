"use client";

import { motion } from "framer-motion";
import type { DS160Step as DS160StepType } from "@/lib/api";
import { DS160Step } from "./DS160Step";

interface Props {
  steps: DS160StepType[];
}

export function DS160Guide({ steps }: Props) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-[#F0F0FF] font-bold text-lg">Как заполнить DS-160</h2>
        <p className="text-[#8B8BA7] text-sm mt-1">Пошаговый гайд на русском</p>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-6">
        {steps.map((s) => (
          <div
            key={s.step}
            className="w-7 h-7 rounded-full bg-[#1E1E2E] flex items-center justify-center text-[10px] text-[#8B8BA7] font-medium"
          >
            {s.step}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <motion.div
            key={step.step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <DS160Step step={step} isActive={step.step === 1} />
          </motion.div>
        ))}
      </div>

      <div className="mt-6 bg-[#00D4AA]/5 border border-[#00D4AA]/20 rounded-2xl p-4">
        <p className="text-[#00D4AA] text-xs font-semibold mb-1">💡 Совет</p>
        <p className="text-[#8B8BA7] text-xs leading-relaxed">
          Используй Chrome или Firefox. Safari иногда вызывает проблемы с сайтом CEAC.
          Не оставляй анкету незаполненной более 30 минут — может истечь сессия.
        </p>
      </div>
    </div>
  );
}
