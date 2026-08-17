"use client";

import { useTranslation } from "react-i18next";
import type { EmergencyContact } from "@/lib/api";

interface ContactsListProps {
  contacts: EmergencyContact[];
}

const priorityStyle: Record<string, { border: string; labelColor: string }> = {
  emergency: { border: "border-error/40", labelColor: "text-error" },
  first: { border: "border-warning/40", labelColor: "text-warning" },
  secondary: { border: "border-border", labelColor: "text-secondary" },
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
            className={`bg-card border ${style.border} rounded-xl px-4 py-3`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-primary font-semibold text-sm">{contact.name}</span>
              <span className={`text-[10px] font-bold shrink-0 ${style.labelColor}`}>
                {t(`contact_priority.${contact.priority}` as const, { defaultValue: t("contact_priority.secondary") })}
              </span>
            </div>
            <p className="text-secondary text-xs mb-1">{contact.description}</p>
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="inline-block text-error font-bold text-sm mt-1 hover:underline"
              >
                📞 {contact.phone}
              </a>
            )}
            {contact.note && (
              <p className="text-secondary text-xs mt-1 italic">{contact.note}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
