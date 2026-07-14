"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { syncTimeZoneAction } from "@/app/(app)/settings/actions";

/** Keeps the profile's calendar timezone aligned with the device currently using the app. */
export function TimezoneSync({
  currentTimeZone,
  shouldSync,
}: {
  currentTimeZone: string;
  shouldSync: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!shouldSync || !detected || detected === currentTimeZone) return;

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
  }, [currentTimeZone, router, shouldSync]);

  return null;
}
