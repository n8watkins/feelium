"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { syncTimeZoneAction } from "@/app/(app)/settings/actions";

/** Initializes a new profile's timezone from the device exactly once. */
export function TimezoneSync({
  shouldSync,
}: {
  currentTimeZone: string;
  shouldSync: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!shouldSync || !detected) return;

    let cancelled = false;
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
  }, [router, shouldSync]);

  return null;
}
