"use client";

import { Check, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
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
  editHref,
}: {
  behavior: BehaviorForRow;
  entryDate: string;
  booleanValue: boolean | null;
  numericValue: number | null;
  editHref?: string;
}) {
  if (behavior.inputType === "boolean") {
    return (
      <BooleanControl
        behavior={behavior}
        entryDate={entryDate}
        serverValue={booleanValue}
        editHref={editHref}
      />
    );
  }
  return (
    <NumericControl
      behavior={behavior}
      entryDate={entryDate}
      serverValue={numericValue}
      editHref={editHref}
    />
  );
}

type SaveState = "idle" | "saving" | "saved" | "failed";

/**
 * Runs a save as a transition and reports it: "saving" while it runs, "saved" for a moment
 * after, "failed" (with a toast) when it throws, so every tap shows that it was kept.
 */
function useSave(name: string) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<"idle" | "saved" | "failed">("idle");
  useEffect(() => {
    if (result !== "saved") return;
    const timer = setTimeout(() => setResult("idle"), 2000);
    return () => clearTimeout(timer);
  }, [result]);

  function save(optimistic: () => void, write: () => Promise<unknown>) {
    startTransition(async () => {
      optimistic();
      try {
        await write();
        setResult("saved");
      } catch {
        setResult("failed");
        toast.error(`Couldn't save ${name}. Check your connection and try again.`);
      }
    });
  }

  const state: SaveState = isPending ? "saving" : result;
  return { state, save };
}

function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span role="status">
      {state === "saving" ? <span className="text-muted-foreground"> · Saving…</span> : null}
      {state === "saved" ? (
        <>
          {" · "}
          <span className="inline-flex items-center gap-0.5 text-foreground">
            <Check className="size-3" aria-hidden="true" />
            Saved
          </span>
        </>
      ) : null}
      {state === "failed" ? <span className="text-red-700 dark:text-destructive"> · Not saved</span> : null}
    </span>
  );
}

function RowShell({
  name,
  status,
  saveState,
  children,
  editHref,
}: {
  name: string;
  status: string;
  saveState: SaveState;
  children: React.ReactNode;
  editHref?: string;
}) {
  return (
    <li className="flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border border-border py-2.5 pr-2.5 pl-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="truncate text-[15px] font-medium">{name}</span>
          {editHref ? (
            <Link
              href={editHref}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Edit ${name}`}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">
          {status}
          <SaveStatus state={saveState} />
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </li>
  );
}

function BooleanControl({
  behavior,
  entryDate,
  serverValue,
  editHref,
}: {
  behavior: BehaviorForRow;
  entryDate: string;
  serverValue: boolean | null;
  editHref?: string;
}) {
  const [value, setValue] = useOptimistic<boolean | null, boolean | null>(
    serverValue,
    (_current, next) => next,
  );
  const { state, save } = useSave(behavior.name);

  function choose(next: boolean | null) {
    save(
      () => setValue(next),
      () =>
        next === null
          ? clearBehaviorEntryAction(behavior.id, entryDate)
          : setBehaviorBooleanAction(behavior.id, next, entryDate),
    );
  }

  return (
    <RowShell
      name={behavior.name}
      status={value === null ? "Not recorded" : value ? "Did it" : "Didn't"}
      saveState={state}
      editHref={editHref}
    >
      <div
        role="group"
        aria-label={behavior.name}
        className="flex rounded-full bg-muted p-1"
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
        "inline-flex h-10 min-w-14 items-center justify-center gap-1 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {selected ? <Check className="size-3.5" aria-hidden="true" /> : null}
      {label}
    </button>
  );
}

function NumericControl({
  behavior,
  entryDate,
  serverValue,
  editHref,
}: {
  behavior: BehaviorForRow;
  entryDate: string;
  serverValue: number | null;
  editHref?: string;
}) {
  const [value, setValue] = useOptimistic<number | null, number | null>(
    serverValue,
    (_current, next) => next,
  );
  const { state, save } = useSave(behavior.name);

  function commit(next: number | null) {
    save(
      () => setValue(next),
      () =>
        next === null
          ? clearBehaviorEntryAction(behavior.id, entryDate)
          : setBehaviorNumericAction(behavior.id, next, entryDate),
    );
  }

  return (
    <RowShell
      name={behavior.name}
      status={value === null ? "Not recorded" : "Recorded"}
      saveState={state}
      editHref={editHref}
    >
      <NumericStepper
        value={value}
        onChange={commit}
        unit={behavior.unit}
        label={behavior.name}
      />
    </RowShell>
  );
}
