"use client";

import { useRouter } from "next/navigation";

const STEP_ACTIONS: Record<string, { label: string; href: string }> = {
  documents: { label: "Проверить документы →", href: "/documents" },
  ds160: { label: "Открыть документы →", href: "/documents" },
  interview_prep: { label: "Открыть симулятор →", href: "/simulator" },
  interview: { label: "Открыть симулятор →", href: "/simulator" },
};

const DEFAULT_ACTION = { label: "Спросить AI →", href: "/chat" };

interface Props {
  stepId: string;
}

export function ActionButton({ stepId }: Props) {
  const router = useRouter();
  const action = STEP_ACTIONS[stepId] ?? DEFAULT_ACTION;

  return (
    <button
      onClick={() => router.push(action.href)}
      className="mt-3 text-xs font-semibold text-[#6C63FF] hover:text-[#9C8BFF] transition-colors flex items-center gap-1"
    >
      {action.label}
    </button>
  );
}
