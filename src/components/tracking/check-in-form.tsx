"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
    startTransition(async () => {
      const result = checkInId
        ? await updateCheckInAction(checkInId, payload, returnTo)
        : await createCheckInAction(payload);
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <form action={save} className="space-y-8">
      <section className="space-y-4" aria-labelledby="outcomes-heading">
        <h2 id="outcomes-heading" className="text-sm font-medium text-muted-foreground">
          How do you feel?
        </h2>
        {outcomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No outcomes yet - add one to record how you feel.
          </p>
        ) : (
          <ul className="space-y-4">
            {outcomes.map((outcome) => (
              <li key={outcome.id} className="space-y-2">
                <span className="text-sm font-medium">{outcome.name}</span>
                <OutcomeControl
                  outcome={outcome}
                  answer={answers[outcome.id]}
                  onChange={(next) => patch(outcome.id, next)}
                />
              </li>
            ))}
          </ul>
        )}
        {outcomes.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Leave anything blank - unanswered outcomes stay unknown.
          </p>
        ) : null}
        {/* Mirror the inline "add a tag" affordance: add a new outcome and come back here. */}
        <Button asChild variant="outline" className="w-full">
          <Link
            href={`/settings/outcomes/new?from=${encodeURIComponent(
              checkInId ? `/checkin/${checkInId}` : "/checkin/new",
            )}`}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add outcome
          </Link>
        </Button>
      </section>

      <section className="space-y-3" aria-labelledby="tags-heading">
        <h2 id="tags-heading" className="text-sm font-medium text-muted-foreground">
          Tags <span className="font-normal">(optional)</span>
        </h2>
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
              onClick={() =>
                setNewTagNames((prev) => prev.filter((n) => n !== name))
              }
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add a tag"
            maxLength={MAX_NAME_LENGTH}
            aria-label="Add a tag"
          />
          <Button type="button" variant="outline" onClick={addTag}>
            Add
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <Label htmlFor="note">
          Note <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything worth remembering?"
          maxLength={MAX_NOTE_LENGTH}
        />
      </section>

      <Button type="submit" size="lg" className="h-12 w-full" disabled={isPending}>
        {isPending ? "Saving…" : checkInId ? "Save changes" : "Save check-in"}
      </Button>
    </form>
  );
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
          className="flex gap-2"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={answer.rating === n}
              aria-label={`${n} out of 5`}
              onClick={() => onChange({ rating: answer.rating === n ? null : n })}
              className={cn(
                "flex h-12 flex-1 items-center justify-center rounded-md border text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                answer.rating === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-accent",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        {/* Anchor the bare 1-5 with meaning and (when set) the desired direction. */}
        <div
          id={anchorsId}
          className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
        >
          <span>1 · {anchors.low}</span>
          {anchors.hint ? (
            <span className="font-medium text-foreground/70">{anchors.hint}</span>
          ) : null}
          <span>{anchors.high} · 5</span>
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
              "inline-flex min-h-12 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              answer.boolean === val
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-accent",
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
        "inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
