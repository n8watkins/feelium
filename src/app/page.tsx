import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { branding } from "@/config/branding";

import { SignInCta } from "./preview/_ui";

// PREVIEW ONLY (not for merge): a public landing page at "/" for signed-out visitors.
// Signed-in visitors still go straight to Today, and the installed PWA starts at /today.

function Mark({ className = "size-7" }: { className?: string }) {
  // Logo A2 on its tile.
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#0A0A0A" />
      <circle cx="196" cy="256" r="118" fill="#737373" />
      <circle cx="316" cy="256" r="118" fill="#FAFAFA" />
      <path d="M 256.0 154.4 A 118 118 0 0 1 256.0 357.6 A 118 118 0 0 1 256.0 154.4 Z" fill="#0A0A0A" />
    </svg>
  );
}

function Phone({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-[2rem] border border-border bg-background shadow-[0_24px_60px_-24px_rgb(0_0_0/0.35)] ${className}`}
    >
      <Image src={src} alt={alt} width={780} height={1688} className="block h-auto w-full" priority />
    </div>
  );
}

function Browser({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)]">
      <div className="flex h-8 items-center gap-1.5 border-b border-border bg-muted/60 px-3" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-border" /><span className="size-2.5 rounded-full bg-border" /><span className="size-2.5 rounded-full bg-border" />
        <span className="ml-3 truncate text-[11px] text-muted-foreground">feelium.n8builds.dev</span>
      </div>
      <Image src={src} alt={alt} width={1920} height={1200} className="block h-auto w-full" />
    </div>
  );
}

const WAITLIST = "https://n8builds.dev/upcoming?interest=feelium#feelium";

const IN_USE = [
  { src: "/welcome/m-checkin.png", title: "Check in", body: "Four taps and a note. Skip anything." },
  { src: "/welcome/m-today.png", title: "Today", body: "Yes, no or a number, saved as you tap." },
  { src: "/welcome/m-trends.png", title: "Trends", body: "Averages, highs and lows for each feeling." },
  { src: "/welcome/m-reminders.png", title: "Reminders", body: "Gentle nudges at the times you pick." },
];

const STEPS = [
  {
    n: "1",
    title: "Pick what to track",
    body: "Start with a suggested set or your own. A behavior is a yes or no (exercise, doomscrolling) or a number (cups of coffee, hours of screen time).",
  },
  {
    n: "2",
    title: "Check in when you want",
    body: "Rate mood, anxiety, energy or focus from 1 to 5. Skip anything. A blank stays blank, it never turns into a zero.",
  },
  {
    n: "3",
    title: "Read the patterns",
    body: "Once a behavior has at least 5 days with it and 5 without, Insights compares how you felt on each. In plain words, with the caveat.",
  },
];

const WONT = [
  "No streaks, scores or badges.",
  "No public profiles or share links.",
  "No selling your data, and no training models on it.",
  "No medical advice. It shows associations in your own data, not causes.",
];

export default async function RootPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/today");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <Mark />
          {branding.appName}
        </Link>
        <SignInCta
          className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Sign in
        </SignInCta>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-8 pb-20 md:grid-cols-[1.05fr_1fr] md:px-8 md:pt-16">
          <div className="max-w-xl">
            <p className="mb-4 text-sm font-medium text-muted-foreground">A small daily tracker</p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-balance md:text-6xl">
              What did I do, how did I feel, and are they connected?
            </h1>
            <p className="mt-6 text-lg text-muted-foreground text-pretty">
              Log a few behaviors, check in on how you feel, and after a couple of weeks
              Feelium shows you which days went with which. That&apos;s the whole app.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={WAITLIST}
                className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Join the waitlist
              </a>
              <a
                href="#in-use"
                className="inline-flex h-11 items-center rounded-md border border-border px-5 text-sm font-medium hover:bg-accent"
              >
                See it in use
              </a>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">I&apos;m opening it to the waitlist first. Already in? Use Sign in above.</p>
          </div>

          <div className="relative mx-auto h-[440px] w-full max-w-[420px] md:h-[560px]">
            <Phone
              src="/welcome/m-checkin.png"
              alt="The Check in screen with 1 to 5 scales for mood, anxiety, energy and focus"
              className="absolute top-0 left-0 w-[58%] -rotate-3"
            />
            <Phone
              src="/welcome/m-today.png"
              alt="Today with Exercise and Reading done, no doomscrolling and 2 cups of coffee"
              className="absolute top-12 right-0 w-[62%] rotate-2"
            />
          </div>
        </section>

        <section id="in-use" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-8">
            <h2 className="text-3xl font-semibold tracking-tight">A day with Feelium</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Real screens from the app, with a sample month of data.
            </p>
            <div className="mt-10">
              <Browser src="/welcome/d-today.png" alt="Today on a laptop: behaviors recorded and the latest check-in" />
            </div>
            <ul className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
              {IN_USE.map((shot) => (
                <li key={shot.title}>
                  <Phone src={shot.src} alt={`${shot.title}: ${shot.body}`} className="rounded-[1.5rem]" />
                  <h3 className="mt-4 font-semibold">{shot.title}</h3>
                  <p className="text-sm text-muted-foreground">{shot.body}</p>
                </li>
              ))}
            </ul>
            <div className="mt-16 grid items-center gap-10 md:grid-cols-[1fr_1.2fr]">
              <div className="max-w-md">
                <h3 className="text-2xl font-semibold tracking-tight">On your Home Screen, like an app</h3>
                <p className="mt-3 text-muted-foreground">
                  There&apos;s nothing to download from a store. On an iPhone, add it from Safari&apos;s
                  Share menu; on Android, Chrome offers Install app. It opens full screen, and
                  reminders arrive like any app&apos;s notifications.
                </p>
                <p className="mt-3 text-sm text-muted-foreground">Reminders on iPhone need iOS 16.4 or later.</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <figure>
                  <Phone src="/welcome/install-ios.png" alt="On iPhone: the steps to add feelium to the Home Screen from Safari" className="rounded-[1.5rem]" />
                  <figcaption className="mt-3 text-sm text-muted-foreground">iPhone and iPad, in Safari</figcaption>
                </figure>
                <figure>
                  <Phone src="/welcome/install-android-phone.png" alt="On Android: the Install app button" className="rounded-[1.5rem]" />
                  <figcaption className="mt-3 text-sm text-muted-foreground">Android, in Chrome</figcaption>
                </figure>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="border-t border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-8">
            <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              About a minute a day. Most of it is tapping Yes or No.
            </p>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step) => (
                <li key={step.n} className="rounded-xl border border-border bg-background p-6">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {step.n}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:px-8">
          <div className="min-w-0">
            <Browser src="/welcome/d-insights.png" alt="Insights on a laptop comparing how you felt on days with and without each behavior" />
          </div>
          <div className="max-w-lg">
            <h2 className="text-3xl font-semibold tracking-tight">Patterns, in plain words</h2>
            <p className="mt-4 text-muted-foreground">
              &ldquo;Your anxiety tended to be 1.5 points higher on days when you recorded
              doomscrolling.&rdquo; That is the kind of line Insights writes, with how many days
              it is based on and the reminder that it is an association, not a cause.
            </p>
            <p className="mt-4 text-muted-foreground">
              Until there is enough data, it says so and tells you how close you are.
            </p>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-2 md:px-8">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">What it won&apos;t do</h2>
              <ul className="mt-6 space-y-3">
                {WONT.map((line) => (
                  <li key={line} className="flex gap-3 text-muted-foreground">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground" aria-hidden="true" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Your data stays yours</h2>
              <p className="mt-6 text-muted-foreground">
                Everything you record is private to your account. It runs on Cloudflare Workers
                with a Turso database, and reminders carry only the reminder text, never your
                entries. Export everything as JSON or delete your account whenever you want.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 md:flex-row md:items-center md:justify-between md:px-8">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Want in?</h2>
              <p className="mt-1 opacity-75">Join the waitlist on n8builds.dev and I&apos;ll email you when there&apos;s room.</p>
            </div>
            <a
              href={WAITLIST}
              className="inline-flex h-11 items-center rounded-md bg-primary-foreground px-5 text-sm font-medium text-primary hover:opacity-90"
            >
              Join the waitlist
            </a>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:px-8">
        <span className="flex items-center gap-2">
          <Mark className="size-5" /> Built by Nathan Watkins
        </span>
        <span className="flex gap-5">
          <a href="https://github.com/n8watkins/feelium" className="hover:text-foreground">
            Source on GitHub
          </a>
          <a href="https://n8builds.dev" className="hover:text-foreground">
            n8builds.dev
          </a>
        </span>
      </footer>
    </div>
  );
}
