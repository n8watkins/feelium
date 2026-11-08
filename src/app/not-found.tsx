import { Compass } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { branding } from "@/config/branding";

/**
 * Global 404 (PRD 7 - friendly, non-judgmental). Rendered inside the root layout for any
 * unmatched path, with a real 404 status (the route guard only guards the app's own
 * screens) and the app's mark at the top so it doesn't look like a stray page. Home is the
 * landing page, which sends signed-in visitors on to Today.
 */
export default function NotFound() {
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
          <Compass className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Page not found</h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            The page you&apos;re looking for isn&apos;t here. It may have moved, or the link
            was mistyped.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
          <BackButton fallback="/" />
        </div>
      </main>
    </div>
  );
}
