"use client";

// PREVIEW ONLY: Insights leads with findings written as sentences, then the raw patterns.
import { useState } from "react";

import { Section, Shell } from "../_ui";

const FINDINGS = [
  { lead: "Anxiety ran", amount: "1.4 points higher", tail: "on days you doomscrolled.", outcome: "Anxiety", a: { label: "Doomscrolled", value: 3.5, days: 11 }, b: { label: "Didn't", value: 2.1, days: 9 }, higherIsBetter: false },
  { lead: "Mood was", amount: "0.9 points higher", tail: "on days you exercised.", outcome: "Mood", a: { label: "Exercised", value: 3.9, days: 14 }, b: { label: "Didn't", value: 3.0, days: 12 }, higherIsBetter: true },
  { lead: "Focus was", amount: "about the same", tail: "with or without coffee.", outcome: "Focus", a: { label: "Coffee", value: 3.4, days: 21 }, b: { label: "No coffee", value: 3.3, days: 6 }, higherIsBetter: true },
];

// 30 days of mood (1 to 5), null where nothing was recorded. Ends today, Tuesday Nov 3.
const MOOD = [3, 4, null, 2, 3, 3, 4, 5, 4, null, 3, 2, 2, 3, 4, 4, null, null, 3, 4, 5, 4, 3, 3, 2, 3, 4, 4, 3, 4];
const BEHAVIORS = [
  { name: "Exercise", days: [1,0,1,1,0,0,1,1,1,0,1,0,0,1,1,1,0,0,1,1,1,1,0,1,0,0,1,1,0,1] },
  { name: "Doomscrolling", days: [0,0,1,1,1,0,0,0,0,1,1,1,1,0,0,0,1,1,0,0,0,0,1,0,1,1,0,0,1,0] },
  { name: "Reading", days: [1,1,0,0,1,1,1,1,0,0,1,0,0,1,1,0,0,0,1,1,1,1,1,0,0,1,1,1,1,0] },
  { name: "Meditation", days: [0,1,0,0,0,1,1,1,1,0,0,0,0,0,1,1,0,0,0,1,1,1,0,0,0,0,1,1,0,1] },
];

function Comparison({ f }: { f: (typeof FINDINGS)[number] }) {
  const x = (v: number) => `${((v - 1) / 4) * 100}%`;
  return (
    <article className="rounded-3xl border border-[var(--rd-line)] p-5 md:p-7">
      <p className="text-[22px] font-medium leading-snug tracking-[-0.02em] md:text-[26px]">
        {f.lead} <strong className="font-semibold underline decoration-2 underline-offset-[6px]">{f.amount}</strong> {f.tail}
      </p>
      <div className="mt-6 space-y-4">
        {[f.a, f.b].map((row, i) => (
          <div key={row.label} className="grid grid-cols-[112px_1fr_32px] items-center gap-3 text-sm md:grid-cols-[120px_1fr_40px]">
            <span className="text-[var(--rd-soft)] leading-tight">{row.label} <span className="block text-xs">{row.days} days</span></span>
            <div className="relative h-6">
              <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--rd-line)]" />
              {[1, 2, 3, 4, 5].map((t) => (
                <span key={t} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-[var(--rd-mid)]" style={{ left: x(t) }} />
              ))}
              <span className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ${i === 0 ? "bg-[var(--rd-ink)]" : "border-2 border-[var(--rd-ink)] bg-[var(--rd-bg)]"}`} style={{ left: x(row.value) }} />
            </div>
            <span className="text-right font-semibold tabular-nums">{row.value.toFixed(1)}</span>
          </div>
        ))}
        <div className="grid grid-cols-[112px_1fr_32px] gap-3 text-[11px] text-[var(--rd-soft)] md:grid-cols-[120px_1fr_40px]">
          <span />
          <div className="flex justify-between"><span>1</span><span>{f.outcome}, 1 to 5</span><span>5</span></div>
          <span />
        </div>
      </div>
      <p className="mt-4 text-xs text-[var(--rd-soft)]">From your last 30 days. An association in your data, not a cause.</p>
    </article>
  );
}

export default function PreviewInsights() {
  const [range, setRange] = useState("30 days");
  const shade = (v: number | null) => (v == null ? "transparent" : `color-mix(in oklab, var(--rd-ink) ${[0, 18, 36, 56, 76, 100][v]}%, var(--rd-bg))`);
  return (
    <Shell wide>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--rd-soft)]">Oct 5 to Nov 3</p>
          <h1 className="text-[40px] font-semibold leading-none tracking-[-0.035em] md:text-5xl">Insights</h1>
        </div>
        <div role="tablist" aria-label="Range" className="flex rounded-full bg-[var(--rd-fill)] p-1 text-sm font-medium">
          {["7 days", "30 days", "90 days", "All"].map((r) => (
            <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={`h-8 rounded-full px-3.5 ${range === r ? "bg-[var(--rd-ink)] text-[var(--rd-bg)]" : "text-[var(--rd-soft)]"}`}>{r}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-12">
        <Section title="What stands out">
          <div className="grid gap-4 lg:grid-cols-2">
            {FINDINGS.slice(0, 2).map((f) => <Comparison key={f.amount} f={f} />)}
          </div>
          <div className="mt-4"><Comparison f={FINDINGS[2]} /></div>
        </Section>

        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <Section title="Mood, day by day" aside={<span className="text-xs text-[var(--rd-soft)]">Average 3.4</span>}>
            <div className="rounded-3xl border border-[var(--rd-line)] p-5">
              <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-[var(--rd-soft)]">
                {["W", "T", "F", "S", "S", "M", "T"].map((d, i) => <span key={i}>{d}</span>)}
                {MOOD.map((v, i) => (
                  <span key={i} title={v == null ? "Nothing recorded" : `Mood ${v}`} className={`aspect-square rounded-lg ${v == null ? "border border-dashed border-[var(--rd-line)]" : ""}`} style={{ background: shade(v) }} />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--rd-soft)]">
                <span>1</span>
                {[1, 2, 3, 4, 5].map((v) => <span key={v} className="size-3 rounded" style={{ background: shade(v) }} />)}
                <span>5</span>
                <span className="ml-auto">Dashed: nothing recorded</span>
              </div>
            </div>
          </Section>

          <Section title="How often you did each">
            <ul className="divide-y divide-[var(--rd-line)] rounded-3xl border border-[var(--rd-line)] px-5">
              {BEHAVIORS.map((b) => {
                const count = b.days.filter(Boolean).length;
                return (
                  <li key={b.name} className="py-4">
                    <div className="mb-2 flex items-baseline justify-between text-sm">
                      <span className="font-medium">{b.name}</span>
                      <span className="tabular-nums text-[var(--rd-soft)]"><strong className="font-semibold text-[var(--rd-ink)]">{count}</strong> of 30 days</span>
                    </div>
                    <div className="flex gap-[3px]">
                      {b.days.map((d, i) => <span key={i} className={`h-5 flex-1 rounded-[3px] ${d ? "bg-[var(--rd-ink)]" : "bg-[var(--rd-fill)]"}`} />)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>
      </div>
    </Shell>
  );
}
