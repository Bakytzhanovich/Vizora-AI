"use client";

import { useState } from "react";

const SWATCHES = [
  { color: "#6C63FF", label: "Фиолетовый" },
  { color: "#2563EB", label: "Синий" },
  { color: "#10B981", label: "Зелёный" },
  { color: "#F59E0B", label: "Оранжевый" },
  { color: "#EF4444", label: "Красный" },
];

// WCAG AA contrast on dark background (#0A0A0F ≈ luminance 0.002)
function getRelativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function hasGoodContrast(hex: string): boolean {
  const L1 = getRelativeLuminance(hex);
  const L2 = 0.002; // approx #0A0A0F
  const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  return ratio >= 3.0; // AA large text
}

interface Props {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  const [custom, setCustom] = useState(
    SWATCHES.some((s) => s.color === value) ? "" : value
  );
  const [contrastError, setContrastError] = useState(false);

  const pick = (color: string) => {
    if (!hasGoodContrast(color)) {
      setContrastError(true);
      return;
    }
    setContrastError(false);
    onChange(color);
  };

  const handleCustom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setCustom(v);
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
      pick(v);
    }
  };

  return (
    <div>
      {/* Swatches */}
      <div className="flex gap-3 mb-3">
        {SWATCHES.map(({ color, label }) => (
          <button
            key={color}
            type="button"
            title={label}
            onClick={() => { setCustom(""); pick(color); }}
            className="w-10 h-10 rounded-full transition-all"
            style={{
              backgroundColor: color,
              boxShadow: value === color ? `0 0 0 3px white, 0 0 0 5px ${color}` : "none",
            }}
          />
        ))}
      </div>

      {/* Custom hex input */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg border border-gray-200 shrink-0"
          style={{ backgroundColor: value }}
        />
        <input
          type="text"
          value={custom || value}
          onChange={handleCustom}
          placeholder="#6C63FF"
          maxLength={7}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition font-mono"
        />
      </div>
      {contrastError && (
        <p className="text-xs text-red-500 mt-1.5">
          Этот цвет слишком тёмный — плохой контраст на тёмном фоне. Выберите другой.
        </p>
      )}
    </div>
  );
}
