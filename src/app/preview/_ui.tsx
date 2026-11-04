"use client";

// PREVIEW ONLY (not for merge): the proposed redesign, with sample data and no database.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export function Mark({ className = "h-5" }: { className?: string }) {
  // Logo A2 (three tones): grey disc, ink disc, the overlap in the page background.
  return (
    <svg viewBox="68 128 376 256" className={`${className} w-auto`} aria-hidden="true">
      <circle cx="196" cy="256" r="118" fill="var(--rd-logo-left)" />
      <circle cx="316" cy="256" r="118" fill="var(--rd-ink)" />
      <path d="M 256.0 154.4 A 118 118 0 0 1 256.0 357.6 A 118 118 0 0 1 256.0 154.4 Z" fill="var(--rd-bg)" />
    </svg>
  );
}

const TABS = [
  { href: "/preview/today", label: "Today" },
  { href: "/preview/insights", label: "Insights" },
  { href: "/preview/settings", label: "Settings" },
];

function TabIcon({ label }: { label: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (label === "Today")
    return (<svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...common} /><path d="M12 7.5V12l3 2" {...common} /></svg>);
  if (label === "Insights")
    return (<svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden="true"><circle cx="9" cy="12" r="5.5" {...common} /><circle cx="15" cy="12" r="5.5" {...common} /></svg>);
  return (<svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" {...common} /><circle cx="16" cy="7" r="2" {...common} /><circle cx="10" cy="17" r="2" {...common} /></svg>);
}

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  return (
    <div className="rd min-h-dvh bg-[var(--rd-bg)] text-[var(--rd-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--rd-line)] bg-[var(--rd-bg)]/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-8 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:px-8">
          <Link href="/preview/today" className="flex items-center gap-2 font-semibold tracking-tight">
            <Mark /> feelium
          </Link>
          <nav aria-label="Primary" className="hidden h-full items-stretch gap-6 md:flex">
            {TABS.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center border-b-2 text-sm font-medium transition-colors ${active ? "border-[var(--rd-ink)] text-[var(--rd-ink)]" : "border-transparent text-[var(--rd-soft)] hover:text-[var(--rd-ink)]"}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/preview/today#checkin"
            className="ml-auto hidden h-9 items-center rounded-full bg-[var(--rd-ink)] px-4 text-sm font-medium text-[var(--rd-bg)] md:inline-flex"
          >
            Check in
          </Link>
          <span className="ml-auto flex size-8 items-center justify-center rounded-full bg-[var(--rd-fill)] text-xs font-semibold md:ml-0" aria-label="Signed in as Nathan">N</span>
        </div>
      </header>
      <main className={`mx-auto px-4 pb-32 pt-6 md:px-8 md:pb-16 md:pt-10 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>{children}</main>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--rd-line)] bg-[var(--rd-bg)] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-3">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-[var(--rd-ink)]" : "text-[var(--rd-soft)]"}`}
                >
                  <TabIcon label={tab.label} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function Section({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="min-w-0 scroll-mt-20">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--rd-soft)]">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The sign-in modal: opened over the current page, GitHub inside, returns to where you were. */
export function SignInModal({ open, onClose, returnTo }: { open: boolean; onClose: () => void; returnTo: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="rd fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        className="w-full max-w-sm rounded-t-3xl bg-[var(--rd-bg)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[var(--rd-ink)] shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <Mark className="h-7" />
          <button type="button" onClick={onClose} className="-m-2 rounded-full p-2 text-[var(--rd-soft)] hover:text-[var(--rd-ink)]" aria-label="Close">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <h2 id="signin-title" className="mt-5 text-2xl font-semibold tracking-tight">Sign in to feelium</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--rd-soft)]">
          Your check-ins stay private to your account. You&apos;ll come back to {returnTo === "/" ? "this page" : <code className="text-[var(--rd-ink)]">{returnTo}</code>} after.
        </p>
        <button type="button" className="mt-6 flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-[var(--rd-ink)] text-sm font-semibold text-[var(--rd-bg)]">
          <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
          Continue with GitHub
        </button>
        <p className="mt-4 text-center text-xs text-[var(--rd-soft)]">
          New here? The same button creates your account. <a href="/settings/privacy" className="underline underline-offset-2">How we handle your data</a>
        </p>
      </div>
    </div>
  );
}

export function useSignIn() {
  const [open, setOpen] = useState(false);
  return { open, show: () => setOpen(true), hide: () => setOpen(false) };
}

/** A button that opens the sign-in modal over the current page. */
export function SignInCta({ className, children }: { className?: string; children: ReactNode }) {
  const { open, show, hide } = useSignIn();
  const pathname = usePathname();
  return (
    <>
      <button type="button" className={className} onClick={show} data-signin>
        {children}
      </button>
      <SignInModal open={open} onClose={hide} returnTo={pathname} />
    </>
  );
}
