"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const benefits = [
  {
    icon: "⏰",
    title: "Экономия времени",
    description:
      "Менеджер отвечает на одни и те же вопросы сотни раз. AI снимает эту нагрузку 24/7.",
    metric: "80%",
    metricLabel: "типовых вопросов закрывает AI",
  },
  {
    icon: "📊",
    title: "Dashboard и аналитика",
    description:
      "Видите прогресс каждого студента. Алерты кто не готовится к интервью.",
    metric: "Реалтайм",
    metricLabel: "мониторинг готовности",
  },
  {
    icon: "🏆",
    title: "Выше % получения виз",
    description:
      "Подготовленные студенты получают визы чаще. Это ваша репутация и новые клиенты.",
    metric: "+34%",
    metricLabel: "средний рост одобрений",
  },
];

const plans = [
  {
    name: "Старт",
    price: "$150",
    period: "/мес",
    students: "до 50 студентов",
    features: ["Базовый dashboard", "White-label", "Email поддержка"],
    highlight: false,
  },
  {
    name: "Рост",
    price: "$300",
    period: "/мес",
    students: "до 200 студентов",
    features: ["Полный dashboard + аналитика", "Алерты и напоминания", "Telegram поддержка", "Ежемесячный отчёт"],
    highlight: true,
  },
  {
    name: "Партнёр",
    price: "$700",
    period: "/мес",
    students: "до 500 студентов",
    features: ["Всё из Рост", "Эксклюзивность города", "Кастомные сценарии", "Совместный маркетинг"],
    highlight: false,
  },
];

export function Agencies() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const handleScroll = () => {
    const el = document.querySelector("#early-access");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="agencies" ref={ref} className="py-24 px-4 relative">
      {/* Slightly lighter background */}
      <div className="absolute inset-0 bg-[#13131A]/40" />

      <div className="relative max-w-6xl mx-auto">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-4"
        >
          <span className="text-xs font-semibold text-[#00D4AA] uppercase tracking-widest">
            Для агентств
          </span>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F0F0FF] text-center mb-3 tracking-tight"
        >
          Для агентств Work &amp; Travel
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-[#8B8BA7] text-center text-base sm:text-lg mb-14"
        >
          White‑label AI помощник для ваших студентов
        </motion.p>

        {/* Benefit cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {benefits.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group bg-[#13131A] border border-[#1E1E2E] hover:border-[#00D4AA]/30 rounded-2xl p-6 relative overflow-hidden transition-colors duration-300"
            >
              {/* Teal accent */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00D4AA]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#00D4AA]/5 rounded-full blur-2xl group-hover:bg-[#00D4AA]/10 transition-all duration-300" />

              <div className="relative z-10">
                <div className="text-4xl mb-4">{b.icon}</div>
                <h3 className="text-[#F0F0FF] font-bold text-lg mb-3">{b.title}</h3>
                <p className="text-[#8B8BA7] text-sm leading-relaxed mb-5">{b.description}</p>

                <div className="border-t border-[#1E1E2E] pt-4">
                  <div className="text-2xl font-bold text-[#00D4AA]">{b.metric}</div>
                  <div className="text-xs text-[#8B8BA7] mt-0.5">{b.metricLabel}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Pricing table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10"
        >
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`rounded-2xl p-6 border transition-all duration-200 ${
                plan.highlight
                  ? "bg-gradient-to-br from-[#6C63FF]/10 to-[#00D4AA]/5 border-[#6C63FF]/30 shadow-lg shadow-[#6C63FF]/10"
                  : "bg-[#13131A] border-[#1E1E2E]"
              }`}
            >
              {plan.highlight && (
                <div className="text-xs font-semibold text-[#6C63FF] bg-[#6C63FF]/10 border border-[#6C63FF]/20 rounded-full px-3 py-1 inline-block mb-3">
                  Популярный
                </div>
              )}
              <div className="text-[#8B8BA7] text-xs font-semibold uppercase tracking-wide mb-1">
                {plan.name}
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-[#F0F0FF]">{plan.price}</span>
                <span className="text-[#8B8BA7] text-sm">{plan.period}</span>
              </div>
              <div className="text-[#8B8BA7] text-xs mb-5">{plan.students}</div>
              <ul className="space-y-2.5">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-[#8B8BA7]">
                    <span className="text-[#00D4AA] mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="flex justify-center"
        >
          <motion.button
            onClick={handleScroll}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-[#0A0A0F] font-bold px-8 py-4 rounded-xl shadow-lg shadow-[#00D4AA]/20 text-sm transition-all duration-200"
          >
            Подключить агентство →
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
