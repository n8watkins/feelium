import { Compass } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** A 404 inside the app (an impossible History date, a deleted check-in): the app's own navigation stays around it. */
export default function AppNotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
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
