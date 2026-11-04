"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { InstallHint } from "@/components/install-hint";

/**
 * After a check-in is saved (/today?checkin=saved): a "Check-in saved." toast, the query
 * param stripped so a refresh doesn't repeat it, and a one-time nudge to put feelium on
 * the Home Screen for reminders (shown until dismissed, never once installed).
 *
 * It stays mounted on Today, so stripping the param doesn't take the nudge away, and the
 * toast is sent on the next tick because on a fresh load the Toaster subscribes after it.
 */
export function CheckInSaved({ justSaved }: { justSaved: boolean }) {
  const router = useRouter();
  const [showNudge, setShowNudge] = useState(justSaved);
  // A save on this page arrives as a prop change on the same instance.
  if (justSaved && !showNudge) setShowNudge(true);

  // One toast per save, even when an effect runs twice (React's development checks).
  const announced = useRef(false);
  useEffect(() => {
    if (!justSaved) {
      announced.current = false;
      return;
    }
    if (announced.current) return;
    announced.current = true;
    setTimeout(() => toast.success("Check-in saved."), 0);
    router.replace("/today", { scroll: false });
  }, [justSaved, router]);

  return showNudge ? (
    <div className="mt-4">
      <InstallHint context="nudge" />
    </div>
  ) : null;
}
