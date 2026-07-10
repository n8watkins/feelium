"use client";

import { Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUnitAmount } from "@/config/tracking";

/**
 * Numeric value control shared by the Today behavior rows and the check-in outcomes.
 *
 * "Unknown" (value === null) is kept distinct from an explicit 0: the minus button is
 * disabled until a value exists, so tapping it can never silently turn unknown into 0. To
 * record a specific number (including 0) the user taps the amount to type it directly.
 */
export function NumericStepper({
  value,
  onChange,
  unit,
  label,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  unit: string | null;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const recorded = value !== null;
  const display = recorded ? formatUnitAmount(value, unit) : "—";

  function startEditing() {
    setDraft(recorded ? String(value) : "");
    setEditing(true);
  }

  function commitDraft() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === "") {
      onChange(null); // cleared -> back to unknown
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) return; // ignore junk, keep current value
    onChange(Math.max(0, parsed));
  }

  if (editing) {
    return (
      <div className="flex items-center gap-3">
        <Input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={draft}
          aria-label={`${label} value`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          className="h-12 flex-1 text-center text-lg font-semibold tabular-nums"
        />
        {unit ? (
          <span className="text-sm text-muted-foreground">{unit}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-12"
        aria-label={`Decrease ${label}`}
        disabled={!recorded}
        onClick={() => onChange(Math.max(0, (value ?? 0) - 1))}
      >
        <Minus className="size-4" aria-hidden="true" />
      </Button>
      <button
        type="button"
        onClick={startEditing}
        aria-label={
          recorded ? `${label}: ${display}. Tap to edit` : `${label}: not recorded. Tap to enter a value`
        }
        className="min-w-20 flex-1 rounded-md py-2 text-center text-lg font-semibold tabular-nums transition-colors hover:bg-accent"
      >
        {display}
      </button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-12"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(recorded ? (value as number) + 1 : 1)}
      >
        <Plus className="size-4" aria-hidden="true" />
      </Button>
      {recorded ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-12"
          aria-label={`Clear ${label}`}
          onClick={() => onChange(null)}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
