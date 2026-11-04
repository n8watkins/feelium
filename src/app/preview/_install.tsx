"use client";

// PREVIEW ONLY: "install on your phone", for the redesign awaiting approval.
// iPhone and iPad Safari get the Share > Add to Home Screen steps (web push needs iOS 16.4+
// and an installed app); Android Chrome gets a real "Install app" button from the
// beforeinstallprompt event; an installed app (display-mode: standalone) sees nothing.
// `?platform=ios` or `?platform=android` forces a platform for previews and screenshots.
import { useEffect, useState, useSyncExternalStore } from "react";

type Platform = "ios" | "android" | null;
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISSED_KEY = "feelium-install-hint-dismissed";

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectPlatform(): Platform {
  const forced = new URLSearchParams(location.search).get("platform");
  if (forced === "ios" || forced === "android") return forced;
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Only Safari can add to the Home Screen on iOS; Chrome and Firefox there cannot install.
  if (iOS && !/CriOS|FxiOS|EdgiOS/.test(ua)) return "ios";
  return null; // Android and desktop Chromium show up through beforeinstallprompt instead.
}

const noSubscribe = () => () => {};

function subscribeStandalone(onChange: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function useInstall() {
  // Browser-only facts, read without a setState-in-effect; the server renders nothing.
  const standalone = useSyncExternalStore(subscribeStandalone, isInstalled, () => true);
  const detected = useSyncExternalStore(noSubscribe, detectPlatform, () => null);
  const storedDismissal = useSyncExternalStore(noSubscribe, readDismissed, () => true);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  const [dismissedNow, setDismissedNow] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // keep Chrome's mini-infobar away; we show our own button
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setJustInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const platform: Platform = prompt ? "android" : detected;
  const installed = standalone || justInstalled;
  const dismissed = storedDismissal || dismissedNow;
  return {
    platform,
    installed,
    dismissed,
    canShow: !installed && platform !== null,
    dismiss() {
      setDismissedNow(true);
      try {
        localStorage.setItem(DISMISSED_KEY, "1");
      } catch {}
    },
    async install() {
      if (!prompt) return;
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setJustInstalled(true);
      setPrompt(null);
    },
    hasPrompt: prompt !== null,
  };
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline size-[18px] -translate-y-px" aria-label="Share">
      <path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline size-[18px] -translate-y-px" aria-label="Add to Home Screen">
      <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The install card. `context` changes the lead line: in Settings it is about reminders,
 * after a first check-in it is a nudge to keep going.
 */
export function InstallHint({ context = "reminders", onClose }: { context?: "reminders" | "nudge"; onClose?: () => void }) {
  const install = useInstall();
  if (!install.canShow || (context === "nudge" && install.dismissed)) return null;
  const close = () => {
    install.dismiss();
    onClose?.();
  };
  const title =
    context === "nudge" ? "Nice first check-in. Want a nudge tomorrow?" : "Add feelium to your Home Screen to get reminders";
  return (
    <section aria-labelledby="install-title" className="relative rounded-3xl border border-[var(--rd-line)] bg-[var(--rd-fill)] p-5">
      <button type="button" onClick={close} aria-label="Not now" className="absolute right-3 top-3 rounded-full p-2 text-[var(--rd-soft)] hover:text-[var(--rd-ink)]">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      <div className="flex items-start gap-4 pr-6">
        {/* The real Home Screen icon, so people recognize it after installing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={48} height={48} className="size-12 shrink-0 rounded-[12px] shadow-sm" />
        <div className="min-w-0">
          <h3 id="install-title" className="text-[15px] font-semibold leading-snug">{title}</h3>
          <p className="mt-1 text-sm text-[var(--rd-soft)]">
            {context === "nudge"
              ? "Add feelium to your Home Screen and it can remind you at the times you pick."
              : "Reminders arrive like any app's notifications, and feelium opens full screen."}
          </p>
        </div>
      </div>
      {install.platform === "ios" ? (
        <>
          <ol className="mt-4 grid gap-2 text-sm">
            <li className="flex items-center gap-3 rounded-2xl bg-[var(--rd-bg)] px-4 py-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--rd-ink)] text-xs font-semibold text-[var(--rd-bg)]">1</span>
              <span>Tap <ShareIcon /> <strong className="font-semibold">Share</strong> in Safari&apos;s toolbar</span>
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-[var(--rd-bg)] px-4 py-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--rd-ink)] text-xs font-semibold text-[var(--rd-bg)]">2</span>
              <span>Choose <AddIcon /> <strong className="font-semibold">Add to Home Screen</strong></span>
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-[var(--rd-bg)] px-4 py-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--rd-ink)] text-xs font-semibold text-[var(--rd-bg)]">3</span>
              <span>Open feelium from your Home Screen, then turn on reminders</span>
            </li>
          </ol>
          <p className="mt-3 text-xs text-[var(--rd-soft)]">Reminders need iOS 16.4 or later.</p>
        </>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={install.install}
            className="h-11 rounded-full bg-[var(--rd-ink)] px-5 text-sm font-semibold text-[var(--rd-bg)] disabled:opacity-60"
            disabled={!install.hasPrompt && process.env.NODE_ENV === "production"}
          >
            Install app
          </button>
          <button type="button" onClick={close} className="h-11 rounded-full px-4 text-sm font-medium text-[var(--rd-soft)]">
            Not now
          </button>
        </div>
      )}
    </section>
  );
}
