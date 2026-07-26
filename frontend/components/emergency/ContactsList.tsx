"use client";

import { useTranslation } from "react-i18next";
import type { EmergencyContact } from "@/lib/api";

interface ContactsListProps {
  contacts: EmergencyContact[];
}

const priorityStyle: Record<string, { border: string; labelColor: string }> = {
  emergency: { border: "border-[#FF6B6B]/40", labelColor: "text-[#FF6B6B]" },
  first: { border: "border-[#F59E0B]/40", labelColor: "text-[#F59E0B]" },
  secondary: { border: "border-[#1E1E2E]", labelColor: "text-[#8B8BA7]" },
};

export function ContactsList({ contacts }: ContactsListProps) {
  const { t } = useTranslation("emergency");
  const sorted = [...contacts].sort((a, b) => {
    const order = { emergency: 0, first: 1, secondary: 2 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((contact) => {
        const style = priorityStyle[contact.priority] ?? priorityStyle.secondary;
        return (
          <div
            key={contact.name}
            className={`bg-[#13131A] border ${style.border} rounded-xl px-4 py-3`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-[#F0F0FF] font-semibold text-sm">{contact.name}</span>
              <span className={`text-[10px] font-bold shrink-0 ${style.labelColor}`}>
                {t(`contact_priority.${contact.priority}` as const, { defaultValue: t("contact_priority.secondary") })}
              </span>
            </div>
            <p className="text-[#8B8BA7] text-xs mb-1">{contact.description}</p>
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="inline-block text-[#FF6B6B] font-bold text-sm mt-1 hover:underline"
              >
                📞 {contact.phone}
              </a>
            )}
            {contact.note && (
              <p className="text-[#8B8BA7] text-xs mt-1 italic">{contact.note}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
