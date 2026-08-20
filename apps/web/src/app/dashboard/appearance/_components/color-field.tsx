"use client";

import * as React from "react";
import { cn } from "@plink/core/utils";

const SWATCHES = [
  "#ffffff", "#f6f2ec", "#d8ff57", "#ffd166", "#ff6b5a", "#ff4fa3",
  "#b388ff", "#6c4cff", "#2743ff", "#4cc9f0", "#2f855a", "#0b0b10",
];

function normalise(value: string) {
  const v = value.trim();
  if (!v) return "";
  return v.startsWith("#") ? v : `#${v}`;
}

export function ColorField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  hint?: string;
}) {
  const [draft, setDraft] = React.useState(value);
  const [lastValue, setLastValue] = React.useState(value);

  // Adjust local state when the theme changes underneath us (e.g. a preset was applied).
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  const valid = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(draft);

  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex items-center gap-2">
        <label
          className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-line-strong"
          style={{ background: valid ? draft : value }}
        >
          <span className="sr-only">{label} colour picker</span>
          <input
            type="color"
            value={valid ? draft : value}
            onChange={(e) => {
              setDraft(e.target.value);
              onChange(e.target.value);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <input
          value={draft}
          onChange={(e) => {
            const next = normalise(e.target.value);
            setDraft(next);
            if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(next)) onChange(next);
          }}
          aria-label={`${label} hex value`}
          spellCheck={false}
          className={cn("field font-mono text-[14px] uppercase", !valid && "border-coral")}
          maxLength={7}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SWATCHES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setDraft(s);
              onChange(s);
            }}
            aria-label={`Use ${s}`}
            className={cn(
              "size-6 rounded-full border transition hover:scale-110",
              value.toLowerCase() === s ? "border-ink ring-2 ring-ink ring-offset-2" : "border-line-strong",
            )}
            style={{ background: s }}
          />
        ))}
      </div>
      {hint && <p className="mt-1.5 text-[13px] text-ink-muted">{hint}</p>}
    </div>
  );
}
