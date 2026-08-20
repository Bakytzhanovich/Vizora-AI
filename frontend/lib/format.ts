// Kazakh month names are spelled out manually rather than via
// toLocaleDateString("kk-KZ", ...) — kk-KZ's ICU data is incomplete in some
// browsers/runtimes (observed: falls back to "M09" instead of "қыркүйек").
const KZ_MONTHS = [
  "қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
  "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан",
];

export function formatDate(iso: string, locale: string = "ru-RU"): string {
  const date = new Date(iso);
  if (locale === "kk-KZ") {
    return `${date.getDate()} ${KZ_MONTHS[date.getMonth()]} ${date.getFullYear()} ж.`;
  }
  return date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}
