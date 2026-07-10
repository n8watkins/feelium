"use client";

import { Check } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import {
  clearBehaviorEntryAction,
  setBehaviorBooleanAction,
  setBehaviorNumericAction,
} from "@/app/(app)/today/actions";
import { NumericStepper } from "@/components/tracking/numeric-stepper";
import { cn } from "@/lib/utils";

type BehaviorForRow = {
  id: string;
  name: string;
  inputType: "boolean" | "numeric";
  unit: string | null;
};

export function BehaviorLogRow({
  behavior,
  entryDate,
  booleanValue,
  numericValue,
}: {
  behavior: BehaviorForRow;
  entryDate: string;
  booleanValue: boolean | null;
  numericValue: number | null;
}) {
  if (behavior.inputType === "boolean") {
    return (
      <BooleanControl
        behavior={behavior}
        entryDate={entryDate}
        serverValue={booleanValue}
      />
    );
  }
  return (
    <NumericControl
      behavior={behavior}
      entryDate={entryDate}
      serverValue={numericValue}
    />
  );
}

function RowShell({
  name,
  recorded,
  children,
}: {
  name: string;
  recorded: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{name}</span>
        {!recorded ? (
          <span className="text-xs text-muted-foreground">Not recorded</span>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </li>
  );
}

function BooleanControl({
  behavior,
  entryDate,
  serverValue,
}: {
  behavior: BehaviorForRow;
  entryDate: string;
  serverValue: boolean | null;
}) {
  const [value, setValue] = useOptimistic<boolean | null, boolean | null>(
    serverValue,
    (_current, next) => next,
  );
  const [, startTransition] = useTransition();

  function choose(next: boolean | null) {
    startTransition(async () => {
      setValue(next);
      try {
        if (next === null) {
          await clearBehaviorEntryAction(behavior.id, entryDate);
        } else {
          await setBehaviorBooleanAction(behavior.id, next, entryDate);
        }
      } catch {
        toast.error(`Couldn't save ${behavior.name}. Reverted.`);
      }
    });
  }

  return (
    <RowShell name={behavior.name} recorded={value !== null}>
      <div
        role="group"
        aria-label={behavior.name}
        className="grid grid-cols-2 gap-2"
      >
        <ChoiceButton
          selected={value === false}
          label="No"
          onClick={() => choose(value === false ? null : false)}
        />
        <ChoiceButton
          selected={value === true}
          label="Yes"
          onClick={() => choose(value === true ? null : true)}
        />
      </div>
    </RowShell>
  );
}

function ChoiceButton({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-accent",
      )}
    >
      {selected ? <Check className="size-4" aria-hidden="true" /> : null}
      {label}
    </button>
  );
}

function NumericControl({
  behavior,
  entryDate,
  serverValue,
}: {
  behavior: BehaviorForRow;
  entryDate: string;
  serverValue: number | null;
}) {
  const [value, setValue] = useOptimistic<number | null, number | null>(
    serverValue,
    (_current, next) => next,
  );
  const [, startTransition] = useTransition();

  function commit(next: number | null) {
    startTransition(async () => {
      setValue(next);
      try {
        if (next === null) {
          await clearBehaviorEntryAction(behavior.id, entryDate);
        } else {
          await setBehaviorNumericAction(behavior.id, next, entryDate);
        }
      } catch {
        toast.error(`Couldn't save ${behavior.name}. Reverted.`);
      }
    });
  }

  return (
    <RowShell name={behavior.name} recorded={value !== null}>
      <NumericStepper
        value={value}
        onChange={commit}
        unit={behavior.unit}
        label={behavior.name}
      />
    </RowShell>
  );
}
