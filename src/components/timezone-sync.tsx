"use client";

import { Clock3, Loader2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  confirmTimeZoneAction,
  syncTimeZoneAction,
} from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";

function displayTimeZone(timezone: string): string {
  return timezone.replaceAll("_", " ");
}

function dismissalKey(currentTimeZone: string, detectedTimeZone: string): string {
  return `feelium:timezone-mismatch:${currentTimeZone}:${detectedTimeZone}`;
}

/** Initializes a new profile's timezone from the device exactly once. */
export function TimezoneSync({
  currentTimeZone,
  shouldSync,
}: {
  currentTimeZone: string;
  shouldSync: boolean;
}) {
  const router = useRouter();
  const [detectedTimeZone, setDetectedTimeZone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detected) return;
    let cancelled = false;

    if (!shouldSync) {
      Promise.resolve().then(() => {
        if (
          !cancelled &&
          detected !== currentTimeZone &&
          localStorage.getItem(dismissalKey(currentTimeZone, detected)) !== "dismissed"
        ) {
          setDetectedTimeZone(detected);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    syncTimeZoneAction(detected)
      .then(() => {
        if (!cancelled) router.refresh();
      })
      .catch(() => {
        // A failed background sync must not block the rest of the signed-in application.
      });
    return () => {
      cancelled = true;
    };
  }, [currentTimeZone, router, shouldSync]);

  if (!detectedTimeZone) return null;

  function dismiss() {
    if (!detectedTimeZone) return;
    localStorage.setItem(
      dismissalKey(currentTimeZone, detectedTimeZone),
      "dismissed",
    );
    setDetectedTimeZone(null);
  }

  function useDeviceTimeZone() {
    if (!detectedTimeZone) return;
    setError("");
    startTransition(async () => {
      const result = await confirmTimeZoneAction(detectedTimeZone);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDetectedTimeZone(null);
      router.refresh();
    });
  }

  return (
    <aside
      aria-labelledby="timezone-mismatch-title"
      className="fixed inset-x-4 top-4 z-50 mx-auto max-w-xl rounded-xl border border-border bg-background p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <Clock3 className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <h2 id="timezone-mismatch-title" className="font-medium">
              Use this device&apos;s timezone?
            </h2>
            <p className="text-sm text-muted-foreground">
              This device uses {displayTimeZone(detectedTimeZone)}, but Feelium uses{" "}
              {displayTimeZone(currentTimeZone)}. Updating keeps Today and reminders on
              your local date.
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={useDeviceTimeZone} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Updating…
                </>
              ) : (
                `Use ${displayTimeZone(detectedTimeZone)}`
              )}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={dismiss} disabled={isPending}>
              Keep {displayTimeZone(currentTimeZone)}
            </Button>
          </div>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={dismiss}
          disabled={isPending}
          aria-label="Dismiss timezone suggestion"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </aside>
  );
}
