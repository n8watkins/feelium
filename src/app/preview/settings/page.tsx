"use client";

// PREVIEW ONLY: Settings as one grouped list; reminders and theme live inline.
import { useState, type ReactNode } from "react";

import { Section, Shell } from "../_ui";

function Group({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-[var(--rd-line)] overflow-hidden rounded-3xl border border-[var(--rd-line)]">{children}</div>;
}

function Row({ title, detail, right, danger = false }: { title: string; detail?: string; right?: ReactNode; danger?: boolean }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        <div className={`text-[15px] font-medium ${danger ? "underline decoration-1 underline-offset-4" : ""}`}>{title}</div>
        {detail ? <div className="truncate text-sm text-[var(--rd-soft)]">{detail}</div> : null}
      </div>
      {right ?? <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-[var(--rd-soft)]" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </div>
  );
}

function Toggle({ on: initial, label }: { on: boolean; label: string }) {
  const [on, setOn] = useState(initial);
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => setOn(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--rd-ink)]" : "bg-[var(--rd-mid)]"}`}>
      <span className={`absolute top-1 size-5 rounded-full bg-[var(--rd-bg)] transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

export default function PreviewSettings() {
  const [theme, setTheme] = useState("System");
  return (
    <Shell>
      <h1 className="mb-10 text-[40px] font-semibold leading-none tracking-[-0.035em] md:text-5xl">Settings</h1>
      <div className="grid gap-10">
        <Section title="Account">
          <Group>
            <div className="flex items-center gap-4 px-5 py-4">
              <span className="flex size-12 items-center justify-center rounded-full bg-[var(--rd-ink)] text-lg font-semibold text-[var(--rd-bg)]">N</span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">Nathan Watkins</div>
                <div className="truncate text-sm text-[var(--rd-soft)]">Signed in with GitHub · n8watkins</div>
              </div>
              <button type="button" className="h-9 rounded-full border border-[var(--rd-line)] px-4 text-sm font-medium">Sign out</button>
            </div>
            <Row title="Sign out on every device" detail="Ends sessions on phones and browsers you're not using now" />
          </Group>
        </Section>

        <Section title="What you track">
          <Group>
            <Row title="Behaviors" detail="Exercise, Doomscrolling, Reading, Coffee and 2 more" />
            <Row title="Feelings" detail="Mood, Anxiety, Energy, Focus" />
            <Row title="Tags" detail="Work, Poor sleep, Social, Travel, Sick" />
          </Group>
        </Section>

        <Section title="Reminders">
          <Group>
            <Row title="8:00 AM" detail="Every day" right={<Toggle on label="8:00 AM reminder" />} />
            <Row title="6:30 PM" detail="Every day" right={<Toggle on label="6:30 PM reminder" />} />
            <Row title="9:45 PM" detail="Paused" right={<Toggle on={false} label="9:45 PM reminder" />} />
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <span className="text-sm text-[var(--rd-soft)]">This phone gets reminders · 2 devices</span>
              <button type="button" className="text-sm font-semibold">+ Add a time</button>
            </div>
          </Group>
        </Section>

        <Section title="Preferences">
          <Group>
            <Row title="Theme" right={
              <div className="flex rounded-full bg-[var(--rd-fill)] p-1 text-sm font-medium">
                {["Light", "Dark", "System"].map((t) => (
                  <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)} className={`h-8 rounded-full px-3 ${theme === t ? "bg-[var(--rd-ink)] text-[var(--rd-bg)]" : "text-[var(--rd-soft)]"}`}>{t}</button>
                ))}
              </div>} />
            <Row title="Time zone" detail="Los Angeles (follows this device)" />
            <Row title="Week starts on" detail="Monday" />
          </Group>
        </Section>

        <Section title="Your data">
          <Group>
            <Row title="Export everything" detail="One JSON file with every entry, note and setting" />
            <Row title="How your data is handled" detail="Private to your account. Never sold or used for training." />
            <Row title="Delete tracking data" detail="Keeps your account and settings" danger />
            <Row title="Delete account" detail="Removes everything and signs you out" danger />
          </Group>
        </Section>
      </div>
    </Shell>
  );
}
