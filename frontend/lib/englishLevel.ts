// Spoken English level test — shared by the student's result screen and the
// agency cabinet.

export const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

// Current results rate fluency, vocabulary and grammar as CEFR levels ("B1").
// Stored older results also have "accuracy" (CEFR) or 0-10 scores on
// coherence/development, so the keys come from the result itself.
const CRITERIA_ORDER = ["fluency", "vocabulary", "grammar", "accuracy", "coherence", "development"] as const;

export type CriterionValue = string | number | null;
export type Criteria = Record<string, CriterionValue>;

export function criteriaKeys(criteria: Criteria): readonly string[] {
  return CRITERIA_ORDER.filter((key) => key in criteria);
}

/** Share of the bar to fill, 0-1. */
export function criterionFraction(value: CriterionValue): number {
  if (value == null) return 0;
  if (typeof value === "number") return value / 10;
  return (CEFR.indexOf(value.replace("+", "") as (typeof CEFR)[number]) + 1) / CEFR.length;
}

export function criterionLabel(value: CriterionValue): string | null {
  if (value == null) return null;
  return typeof value === "number" ? `${value.toFixed(1)}/10` : value;
}
