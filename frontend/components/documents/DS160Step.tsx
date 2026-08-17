"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DS160Step as DS160StepType } from "@/lib/api";

interface Props {
  step: DS160StepType;
  isActive?: boolean;
}

export function DS160Step({ step, isActive }: Props) {
  const [open, setOpen] = useState(isActive ?? false);

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-colors ${
        open ? "border-accent/40 bg-accent/5" : "border-border bg-card"
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <span
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            open ? "bg-accent text-white" : "bg-border text-secondary"
          }`}
        >
          {step.step}
        </span>
        <span className={`flex-1 text-sm font-medium ${open ? "text-primary" : "text-secondary"}`}>
          {step.title}
        </span>
        <span className={`text-secondary text-xs transition-transform ${open ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2.5">
              <p className="text-secondary text-sm leading-relaxed">{step.description}</p>

              {step.important && (
                <div className="flex gap-2 bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                  <span className="text-accent text-sm shrink-0">ℹ️</span>
                  <p className="text-accent-light text-xs leading-relaxed">{step.important}</p>
                </div>
              )}

              {step.warning && (
                <div className="flex gap-2 bg-error/10 border border-error/20 rounded-lg px-3 py-2">
                  <span className="text-error text-sm shrink-0">⚠️</span>
                  <p className="text-error text-xs leading-relaxed font-medium">{step.warning}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
