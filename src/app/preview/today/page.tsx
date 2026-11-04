"use client";

// PREVIEW ONLY: Today and check-in as one screen.
import { useState, useSyncExternalStore } from "react";

import { InstallHint } from "../_install";
import { Section, Shell } from "../_ui";

const OUTCOMES = [
  { name: "Mood", low: "Low", high: "Great", value: 4 },
  { name: "Anxiety", low: "Calm", high: "Anxious", value: 2 },
  { name: "Energy", low: "Drained", high: "Energized", value: 3 },
  { name: "Focus", low: "Scattered", high: "Locked in", value: null as number | null },
];

const BEHAVIORS: { name: string; kind: "bool" | "count"; value: boolean | number | null; unit?: string }[] = [
  { name: "Exercise", kind: "bool", value: true },
  { name: "Doomscrolling", kind: "bool", value: false },
  { name: "Reading", kind: "bool", value: null },
  { name: "Coffee", kind: "count", value: 2, unit: "cups" },
  { name: "Screen time", kind: "count", value: null, unit: "hours" },
  { name: "Meditation", kind: "bool", value: true },
];

const EARLIER = [
  { time: "8:10 AM", values: "Mood 3 · Anxiety 3 · Energy 2", note: "Slept badly, slow start." },
  { time: "1:35 PM", values: "Mood 4 · Anxiety 2 · Energy 4 · Focus 4", note: "Walk at lunch helped." },
];

const TAGS = ["Work", "Poor sleep", "Social", "Travel", "Sick"];

function Scale({ name, low, high, initial }: { name: string; low: string; high: string; initial: number | null }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <div className="py-4 first:pt-0">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[15px] font-medium">{name}</span>
        <span className="text-xs text-[var(--rd-soft)]">{value == null ? "Skipped" : `${value} of 5`}</span>
      </div>
      <div role="radiogroup" aria-label={name} className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setValue(on ? null : n)}
              className={`h-12 rounded-2xl text-base font-semibold tabular-nums transition-colors ${on ? "bg-[var(--rd-ink)] text-[var(--rd-bg)]" : "bg-[var(--rd-fill)] text-[var(--rd-ink)] hover:bg-[var(--rd-line)]"}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-[var(--rd-soft)]">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function Behavior({ b }: { b: (typeof BEHAVIORS)[number] }) {
  const [value, setValue] = useState(b.value);
  if (b.kind === "count") {
    const n = value as number | null;
    return (
      <div className="flex items-center justify-between rounded-2xl border border-[var(--rd-line)] px-4 py-3">
        <div>
          <div className="text-[15px] font-medium">{b.name}</div>
          <div className="text-xs text-[var(--rd-soft)]">{n == null ? "Not recorded" : `${n} ${b.unit}`}</div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={`Less ${b.name}`} onClick={() => setValue(Math.max(0, (n ?? 0) - 1))} className="size-9 rounded-full bg-[var(--rd-fill)] text-lg">−</button>
          <span className="w-8 text-center text-lg font-semibold tabular-nums">{n ?? "–"}</span>
          <button type="button" aria-label={`More ${b.name}`} onClick={() => setValue((n ?? 0) + 1)} className="size-9 rounded-full bg-[var(--rd-fill)] text-lg">+</button>
        </div>
      </div>
    );
  }
  const v = value as boolean | null;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[var(--rd-line)] px-4 py-3">
      <div>
        <div className="text-[15px] font-medium">{b.name}</div>
        <div className="text-xs text-[var(--rd-soft)]">{v == null ? "Not recorded" : v ? "Did it" : "Didn't"}</div>
      </div>
      <div className="flex rounded-full bg-[var(--rd-fill)] p-1 text-sm font-medium">
        {[false, true].map((option) => (
          <button
            key={String(option)}
            type="button"
            aria-pressed={v === option}
            onClick={() => setValue(v === option ? null : option)}
            className={`h-8 w-12 rounded-full ${v === option ? "bg-[var(--rd-ink)] text-[var(--rd-bg)]" : "text-[var(--rd-soft)]"}`}
          >
            {option ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PreviewToday() {
  const [tags, setTags] = useState<string[]>(["Work"]);
  // After the first check-in, a one-time nudge to install (for reminders). `?saved=1` shows it.
  const [savedNow, setSaved] = useState(false);
  const savedParam = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(location.search).get("saved") === "1",
    () => false,
  );
  const saved = savedNow || savedParam;
  return (
    <Shell>
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--rd-soft)]">November 3</p>
          <h1 className="text-[40px] font-semibold leading-none tracking-[-0.035em] md:text-5xl">Tuesday</h1>
        </div>
        <p className="text-right text-sm text-[var(--rd-soft)]">
          <span className="block text-2xl font-semibold tabular-nums text-[var(--rd-ink)]">2</span>
          check-ins today
        </p>
      </div>

      <div className="grid gap-12">
        <Section title="How do you feel right now?" id="checkin" aside={<span className="text-xs text-[var(--rd-soft)]">Tap again to skip</span>}>
          <div className="divide-y divide-[var(--rd-line)] rounded-3xl border border-[var(--rd-line)] p-5 md:p-6">
            {OUTCOMES.map((o) => (
              <Scale key={o.name} name={o.name} low={o.low} high={o.high} initial={o.value} />
            ))}
            <div className="pt-4">
              <div className="mb-2 text-[15px] font-medium">Tags</div>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => {
                  const on = tags.includes(t);
                  return (
                    <button key={t} type="button" aria-pressed={on} onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
                      className={`h-8 rounded-full border px-3 text-sm ${on ? "border-[var(--rd-ink)] bg-[var(--rd-ink)] text-[var(--rd-bg)]" : "border-[var(--rd-line)] text-[var(--rd-ink)]"}`}>
                      {t}
                    </button>
                  );
                })}
                <button type="button" className="h-8 rounded-full border border-dashed border-[var(--rd-mid)] px-3 text-sm text-[var(--rd-soft)]">+ New tag</button>
              </div>
            </div>
            <div className="pt-4">
              <label htmlFor="note" className="mb-2 block text-[15px] font-medium">Note</label>
              <textarea id="note" rows={2} defaultValue="Long meeting block, but the walk helped." className="w-full resize-none rounded-2xl bg-[var(--rd-fill)] px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[var(--rd-ink)]" />
            </div>
          </div>
          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-4 bg-gradient-to-t from-[var(--rd-bg)] from-60% px-4 pb-3 pt-6 md:static md:mx-0 md:bg-none md:p-0">
            <button type="button" onClick={() => setSaved(true)} className="h-12 w-full rounded-full bg-[var(--rd-ink)] text-[15px] font-semibold text-[var(--rd-bg)] md:w-auto md:px-8">
              {saved ? "Saved · 4:12 PM" : "Save check-in"}
            </button>
          </div>
          {saved ? (
            <div id="install-nudge" className="mt-4 scroll-mt-20">
              <InstallHint context="nudge" />
            </div>
          ) : null}
        </Section>

        <Section title="What you did today" aside={<span className="text-xs text-[var(--rd-soft)]">Saved as you tap</span>}>
          <div className="grid gap-2 md:grid-cols-2">
            {BEHAVIORS.map((b) => (
              <Behavior key={b.name} b={b} />
            ))}
          </div>
        </Section>

        <Section title="Earlier today">
          <ol className="relative ml-1.5 border-l border-[var(--rd-line)]">
            {EARLIER.map((c) => (
              <li key={c.time} className="relative pb-6 pl-6 last:pb-0">
                <span className="absolute -left-[5px] top-1.5 size-[9px] rounded-full bg-[var(--rd-ink)]" />
                <div className="text-sm font-semibold tabular-nums">{c.time}</div>
                <div className="text-sm text-[var(--rd-soft)]">{c.values}</div>
                <p className="mt-1 text-sm">{c.note}</p>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </Shell>
  );
}
