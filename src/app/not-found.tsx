import { Compass } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Global 404 (PRD 7 - friendly, non-judgmental). Rendered inside the root layout for any
 * unmatched path. The link home goes to Today for signed-in users, or the login screen for
 * everyone else (the route guard redirects as needed).
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
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
      <Button asChild>
        <Link href="/today">Go to Today</Link>
      </Button>
    </div>
  );
}
