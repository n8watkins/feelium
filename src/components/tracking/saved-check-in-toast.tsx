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
    toast.success("Check-in saved.");
    router.replace("/today");
  }, [router]);

  return null;
}
