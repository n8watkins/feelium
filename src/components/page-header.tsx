import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

/**
 * Screen header. Main screens get a large title with an optional `eyebrow` above it
 * ("November 3" over "Tuesday"); sub-screens pass `backHref` and get a smaller title.
 * `action` sits at the trailing edge, aligned to the title's baseline.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  action,
  backHref,
  backLabel = "Back",
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  const sub = Boolean(backHref);
  return (
    <header className={sub ? "px-4 pt-6 pb-4 md:px-8" : "px-4 pt-8 pb-6 md:px-8 md:pt-10"}>
      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-flex min-h-9 items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          {eyebrow ? <p className="text-sm text-muted-foreground">{eyebrow}</p> : null}
          <h1
            className={
              sub
                ? "text-2xl font-semibold tracking-tight text-balance"
                : "text-[40px] leading-none font-semibold tracking-[-0.035em] text-balance md:text-5xl"
            }
          >
            {title}
          </h1>
          {description ? (
            <p className="max-w-prose pt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
