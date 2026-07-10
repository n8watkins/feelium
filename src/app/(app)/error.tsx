"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Friendly error boundary for the authenticated app (PRD 7 - no guilt, reassuring tone).
 * Catches render/data errors in any (app) route and offers a retry plus a way back to
 * Today, instead of a blank screen or a raw stack trace. Your recorded data is untouched.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced to server logs / monitoring; the user only sees the friendly message.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CircleAlert className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          We hit a snag loading this page. Nothing you&apos;ve recorded was affected -
          try again in a moment.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/today">Go to Today</Link>
        </Button>
      </div>
    </div>
  );
}
