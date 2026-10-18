"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

const STEP_ACTIONS: Record<string, { label: string; href: string }> = {
  documents: { label: "actions.documents", href: "/documents" },
  ds160: { label: "actions.ds160", href: "/documents" },
  interview_prep: { label: "actions.simulator", href: "/simulator" },
  interview: { label: "actions.simulator", href: "/simulator" },
};

const DEFAULT_ACTION = { label: "actions.chat", href: "/chat" };

interface Props {
  stepId: string;
}

export function ActionButton({ stepId }: Props) {
  const router = useRouter();
  const { t } = useTranslation("roadmap");
  const action = STEP_ACTIONS[stepId] ?? DEFAULT_ACTION;

  return (
    <button
      onClick={() => router.push(action.href)}
      className="mt-1 min-h-11 text-xs font-semibold text-accent hover:text-accent-light transition-colors flex items-center gap-1"
    >
      {t(action.label)}
    </button>
  );
}
