"use client";

import type { AfterVisaModuleSummary } from "@/lib/api";
import { ModuleCard } from "./ModuleCard";

interface ModuleGridProps {
  modules: AfterVisaModuleSummary[];
}

export function ModuleGrid({ modules }: ModuleGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {modules.map((mod, i) => (
        <ModuleCard key={mod.id} module={mod} index={i} />
      ))}
    </div>
  );
}
