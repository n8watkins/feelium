"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
  createCheckInAction,
  updateCheckInAction,
} from "@/app/(app)/checkin/actions";
import { NumericStepper } from "@/components/tracking/numeric-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ratingAnchors } from "@/config/tracking";
import type { OutcomeDirection, OutcomeInputType } from "@/db/schema";
import { cn } from "@/lib/utils";
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH } from "@/lib/validation";

type OutcomeForForm = {
  id: string;
  name: string;
  inputType: OutcomeInputType;
  unit: string | null;
  desiredDirection: OutcomeDirection | null;
};
type TagForForm = { id: string; name: string };
type Answer = {
  rating: number | null;
  boolean: boolean | null;
  numeric: number | null;
};

const EMPTY: Answer = { rating: null, boolean: null, numeric: null };

export function CheckInForm({
  localDate,
  outcomes,
  tags,
  checkInId,
  initialAnswers,
  initialTagIds = [],
  initialNote = "",
  returnTo,
}: {
  localDate: string;
  outcomes: OutcomeForForm[];
  tags: TagForForm[];
  checkInId?: string;
  initialAnswers?: Record<string, Answer>;
  initialTagIds?: string[];
  initialNote?: string;
  // Where to go after an edit is saved (e.g. back to a History day). Create ignores it.
  returnTo?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => {
    const base: Record<string, Answer> = {};
    for (const outcome of outcomes) {
      base[outcome.id] = initialAnswers?.[outcome.id] ?? { ...EMPTY };
    }
    return base;
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialTagIds);
  const [newTagNames, setNewTagNames] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [note, setNote] = useState(initialNote);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function patch(id: string, next: Partial<Answer>) {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }));
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  function addTag() {
    const name = tagDraft.trim();
    if (!name) return;
    const existing = tags.find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      if (!selectedTagIds.includes(existing.id)) toggleTag(existing.id);
    } else if (
      !newTagNames.some((n) => n.toLowerCase() === name.toLowerCase())
    ) {
      setNewTagNames((prev) => [...prev, name]);
    }
    setTagDraft("");
  }

  function save() {
    const payload = {
      localDate,
      note: note.trim() || null,
      values: outcomes.map((o) => ({
        outcomeMetricId: o.id,
        rating: answers[o.id].rating,
        boolean: answers[o.id].boolean,
        numeric: answers[o.id].numeric,
      })),
      tagIds: selectedTagIds,
      newTagNames,
    };
    setError(null);
    startTransition(async () => {
      const result = checkInId
        ? await updateCheckInAction(checkInId, payload, returnTo)
        : await createCheckInAction(payload);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form action={save} className="space-y-4">
      <div className="divide-y divide-border rounded-3xl border border-border px-5 md:px-6">
        {outcomes.length === 0 ? (
          <p className="py-5 text-sm text-muted-foreground">
            No feelings to rate yet. Add one to record how you feel.
          </p>
        ) : (
          outcomes.map((outcome) => (
            <div key={outcome.id} className="py-5">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-medium" id={`outcome-${outcome.id}`}>
                  {outcome.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {answerLabel(outcome, answers[outcome.id])}
                </span>
              </div>
              <OutcomeControl
                outcome={outcome}
                answer={answers[outcome.id]}
                onChange={(next) => patch(outcome.id, next)}
              />
            </div>
          ))
        )}

        <div className="py-5" role="group" aria-labelledby="tags-heading">
          <h3 id="tags-heading" className="mb-3 text-[15px] font-medium">
            Tags <span className="font-normal text-muted-foreground">(optional)</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <TagChip
                key={tag.id}
                label={tag.name}
                selected={selectedTagIds.includes(tag.id)}
                onClick={() => toggleTag(tag.id)}
              />
            ))}
            {newTagNames.map((name) => (
              <TagChip
                key={`new-${name}`}
                label={name}
                selected
                onClick={() => setNewTagNames((prev) => prev.filter((n) => n !== name))}
              />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="New tag"
              maxLength={MAX_NAME_LENGTH}
              aria-label="Add a tag"
              className="h-10 rounded-full px-4"
            />
            <Button type="button" variant="outline" className="h-10 rounded-full px-5" onClick={addTag}>
              Add
            </Button>
          </div>
        </div>

        <div className="py-5">
          <Label htmlFor="note" className="mb-3 text-[15px] font-medium">
            Note <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything worth remembering?"
            maxLength={MAX_NOTE_LENGTH}
            className="min-h-20 resize-none rounded-2xl border-transparent bg-muted px-4 py-3 text-[15px] shadow-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
        <span>Leave anything blank: it stays unknown, never zero.</span>
        <Link
          href={`/settings/outcomes/new?from=${encodeURIComponent(checkInId ? `/checkin/${checkInId}` : "/today")}`}
          className="inline-flex min-h-9 items-center gap-1 font-medium hover:text-foreground"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add a feeling to rate
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-red-700 dark:text-destructive">
          {error}
        </p>
      ) : null}
      {/* On phones Save stays reachable above the tab bar while the form scrolls. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 bg-gradient-to-t from-background from-60% to-transparent px-4 pt-6 pb-3 md:static md:mx-0 md:bg-none md:p-0">
        <Button type="submit" size="lg" className="h-12 w-full rounded-full text-[15px] md:w-auto md:px-10" disabled={isPending}>
          {isPending ? "Saving…" : checkInId ? "Save changes" : "Save check-in"}
        </Button>
      </div>
    </form>
  );
}

function answerLabel(outcome: OutcomeForForm, answer: Answer): string {
  if (outcome.inputType === "rating") return answer.rating == null ? "Skipped" : `${answer.rating} of 5`;
  if (outcome.inputType === "boolean") return answer.boolean == null ? "Skipped" : answer.boolean ? "Yes" : "No";
  return answer.numeric == null ? "Skipped" : `${answer.numeric}${outcome.unit ? ` ${outcome.unit}` : ""}`;
}

function OutcomeControl({
  outcome,
  answer,
  onChange,
}: {
  outcome: OutcomeForForm;
  answer: Answer;
  onChange: (next: Partial<Answer>) => void;
}) {
  if (outcome.inputType === "rating") {
    const anchors = ratingAnchors(outcome.desiredDirection);
    const anchorsId = `rating-anchors-${outcome.id}`;
    return (
      <div className="space-y-1.5">
        <div
          role="group"
          aria-label={outcome.name}
          aria-describedby={anchorsId}
          className="grid grid-cols-5 gap-2"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={answer.rating === n}
              aria-label={`${n} out of 5`}
              onClick={() => onChange({ rating: answer.rating === n ? null : n })}
              className={cn(
                "flex h-12 items-center justify-center rounded-2xl text-base font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                answer.rating === n
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-accent dark:hover:bg-secondary",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        {/* Anchor the bare 1-5 with meaning and (when set) the desired direction. */}
        <div
          id={anchorsId}
          className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
        >
          <span>{anchors.low}</span>
          {anchors.hint ? <span className="sr-only">{anchors.hint}</span> : null}
          <span>{anchors.high}</span>
        </div>
      </div>
    );
  }

  if (outcome.inputType === "boolean") {
    return (
      <div role="group" aria-label={outcome.name} className="grid grid-cols-2 gap-2">
        {[
          { label: "No", val: false },
          { label: "Yes", val: true },
        ].map(({ label, val }) => (
          <button
            key={label}
            type="button"
            aria-pressed={answer.boolean === val}
            onClick={() =>
              onChange({ boolean: answer.boolean === val ? null : val })
            }
            className={cn(
              "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              answer.boolean === val
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-accent dark:hover:bg-secondary",
            )}
          >
            {answer.boolean === val ? (
              <Check className="size-4" aria-hidden="true" />
            ) : null}
            {label}
          </button>
        ))}
      </div>
    );
  }

  // numeric
  return (
    <NumericStepper
      value={answer.numeric}
      onChange={(next) => onChange({ numeric: next })}
      unit={outcome.unit}
      label={outcome.name}
    />
  );
}

function TagChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-1 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-accent",
      )}
    >
      {selected ? <Check className="size-3.5" aria-hidden="true" /> : null}
      {label}
    </button>
  );
}
