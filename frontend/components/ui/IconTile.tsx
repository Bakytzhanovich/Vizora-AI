import type { LucideIcon } from "lucide-react";

interface Props {
  icons: LucideIcon[];
  index: number;
  size: number;
  className?: string;
}

/** Renders icons[index], falling back to icons[0] if the content array (i18n
 * JSON) and the icon array ever drift out of sync in length. Shared by every
 * landing-page section that maps a fixed icon set onto translated content by
 * position (Problem, Solution, HowItWorks, Agencies) — previously the same
 * lookup-with-fallback was copy-pasted into each one. */
export function IconTile({ icons, index, size, className }: Props) {
  const Icon = icons[index] ?? icons[0];
  return <Icon size={size} strokeWidth={1.75} className={className} />;
}
