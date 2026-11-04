"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Shows a one-time "check-in saved" confirmation after a create redirects to
 * /today?checkin=saved, then strips the query param so a refresh does not repeat it.
 * Rendered by the Today page only when that param is present.
 */
export function SavedCheckInToast() {
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    // On a full page load this effect runs before the Toaster (later in the layout) has
    // subscribed, so a toast sent now would be dropped: send it on the next tick.
    const timer = setTimeout(() => toast.success("Check-in saved."), 0);
    router.replace("/today");
    return () => clearTimeout(timer);
  }, [router]);

  return null;
}
