"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand-mark";
import { reportError } from "@/components/error-reporting";
import { Button } from "@/components/ui/button";
import { branding } from "@/config/branding";

/**
 * The error page for public routes (the landing page, sign-in, privacy). The signed-in app
 * has its own inside the app shell, (app)/error.tsx. Both offer Retry and a way home, and
 * report the error when Sentry is on.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reportError(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center px-4 py-5 md:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <BrandMark className="h-5" />
          {branding.appName}
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-24 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CircleAlert className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            This page didn&apos;t load. Nothing you&apos;ve recorded was affected - try again in a
            moment.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
