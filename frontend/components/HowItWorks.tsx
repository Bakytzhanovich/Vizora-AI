"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const steps = [
  {
    number: "01",
    icon: "👤",
    title: "Заполни профиль",
    description:
      "Расскажи о себе: университет, дата интервью, уровень английского, история поездок.",
    detail: "Занимает 3 минуты. Это основа персонализации.",
  },
  {
    number: "02",
    icon: "🎯",
    title: "Получи анализ рисков",
    description:
      "AI анализирует твой профиль и показывает слабые места именно для тебя.",
    detail: "Каждый профиль — уникальный сценарий интервью.",
  },
  {
    number: "03",
    icon: "🎤",
    title: "Тренируйся каждый день",
    description:
      "Симулируй интервью с AI‑офицером. Режим Тренер → Режим Консул.",
    detail: "5–10 минут в день — достаточно для уверенности.",
  },
  {
    number: "04",
    icon: "✈️",
    title: "Иди на интервью уверенно",
    description:
      "После 5–10 сессий студенты чувствуют себя готовыми. Реальное интервью легче мока.",
    detail: "Ты уже слышал все вопросы. Ты готов.",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" ref={ref} className="py-24 px-4 relative">
      <div className="max-w-6xl mx-auto">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-4"
        >
          <span className="text-xs font-semibold text-[#00D4AA] uppercase tracking-widest">
            Процесс
          </span>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F0F0FF] text-center mb-4 tracking-tight"
        >
          Как это работает
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-[#8B8BA7] text-center text-base sm:text-lg max-w-xl mx-auto mb-16"
        >
          От регистрации до уверенного интервью — 4 простых шага
        </motion.p>

        {/* Steps — Desktop: horizontal, Mobile: vertical */}
        <div className="relative">
          {/* Connecting line — desktop */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 1, delay: 0.3 }}
            className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-[#6C63FF]/40 via-[#6C63FF]/20 to-[#00D4AA]/40 origin-left"
          />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.12 }}
                className="relative flex flex-col items-center text-center"
              >
                {/* Step number circle */}
                <div className="relative mb-5">
                  {/* Outer ring */}
                  <div className="w-20 h-20 rounded-full border border-[#1E1E2E] bg-[#13131A] flex items-center justify-center relative z-10">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#6C63FF]/20 to-[#6C63FF]/5 border border-[#6C63FF]/20 flex items-center justify-center">
                      <span className="text-2xl">{step.icon}</span>
                    </div>
                  </div>
                  {/* Step number badge */}
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#6C63FF] text-white text-[10px] font-bold flex items-center justify-center z-20">
                    {i + 1}
                  </div>
                </div>

                {/* Number label */}
                <div className="text-[#6C63FF]/40 text-xs font-bold tracking-widest mb-2">
                  {step.number}
                </div>

                <h3 className="text-[#F0F0FF] font-bold text-base mb-2 leading-snug">
                  {step.title}
                </h3>

                <p className="text-[#8B8BA7] text-sm leading-relaxed mb-3">
                  {step.description}
                </p>

                <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl px-3 py-2">
                  <p className="text-[#8B8BA7]/70 text-xs italic">{step.detail}</p>
                </div>

                {/* Mobile connector */}
                {i < steps.length - 1 && (
                  <div className="lg:hidden w-px h-8 bg-gradient-to-b from-[#6C63FF]/30 to-transparent mt-4" />
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-3 bg-[#13131A] border border-[#1E1E2E] rounded-2xl px-6 py-4">
            <span className="text-[#00D4AA] text-xl">🎉</span>
            <p className="text-[#8B8BA7] text-sm">
              <span className="text-[#F0F0FF] font-semibold">Северная звезда Vizora:</span>{" "}
              студент приходит на интервью уверенным и получает визу с первого раза
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
