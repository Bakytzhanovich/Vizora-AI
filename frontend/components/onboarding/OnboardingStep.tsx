"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";

interface Props {
  stepIndex: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack?: () => void;
  canGoBack: boolean;
}

const variants = {
  enter: { x: 60, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -60, opacity: 0 },
};

export function OnboardingStep({ stepIndex, title, subtitle, children, onBack, canGoBack }: Props) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepIndex}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="w-full"
      >
        {/* Back button */}
        <div className="mb-8 h-8 flex items-center">
          {canGoBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-[#8B8BA7] hover:text-[#F0F0FF] text-sm transition-colors duration-200"
            >
              <ArrowLeft size={16} />
              Назад
            </button>
          )}
        </div>

        {/* Question */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F0F0FF] mb-3 leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[#8B8BA7] text-base">{subtitle}</p>
          )}
        </div>

        {/* Step content */}
        <div>{children}</div>
      </motion.div>
    </AnimatePresence>
  );
}
