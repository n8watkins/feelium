import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

/**
 * Consistent screen header used across screens. `title` is the accessible page heading;
 * `action` is an optional trailing control; `backHref`/`backLabel` render a back link
 * above the title for sub-screens.
 */
export function PageHeader({
  title,
  description,
  action,
  backHref,
  backLabel = "Back",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="px-4 pt-6 pb-2 md:px-8">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-2 inline-flex min-h-9 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
