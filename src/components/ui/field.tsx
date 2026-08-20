"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type BaseProps = {
  label?: string;
  hint?: string;
  error?: string;
  id?: string;
};

/** React's useId keeps server and client markup identical across hydration. */
function useFieldId(provided?: string) {
  const generated = React.useId();
  return provided ?? generated;
}

export function TextField({
  label, hint, error, className, id: providedId, ...props
}: BaseProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useFieldId(providedId);
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
        </label>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={cn("field", error && "border-coral focus:border-coral focus:shadow-[0_0_0_4px_#ffe4e0]", className)}
        {...props}
      />
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-[13px] font-medium text-coral">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextArea({
  label, hint, error, className, id: providedId, ...props
}: BaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useFieldId(providedId);
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="field-label">{label}</label>
      )}
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        className={cn("field resize-y min-h-[92px]", error && "border-coral", className)}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-[13px] font-medium text-coral">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Toggle({
  checked, onChange, label, description, disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-start gap-3", disabled ? "opacity-50" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-brand-500" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked && "translate-x-5",
          )}
        />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-semibold text-ink">{label}</span>}
          {description && <span className="block text-[13px] text-ink-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}
