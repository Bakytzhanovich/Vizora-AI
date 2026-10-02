// Spoken English level test — shared by the student's result screen and the
// agency cabinet.

export const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

// Results since the CEFR rubric rate each criterion as a level ("B1");
// earlier ones stored 0-10 scores on a different set of criteria.
export const CRITERIA = ["fluency", "accuracy", "vocabulary", "grammar"] as const;
const LEGACY_CRITERIA = ["grammar", "vocabulary", "coherence", "development", "fluency"] as const;

export type CriterionValue = string | number | null;
export type Criteria = Record<string, CriterionValue>;

export function criteriaKeys(criteria: Criteria): readonly string[] {
  return "accuracy" in criteria ? CRITERIA : LEGACY_CRITERIA;
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
