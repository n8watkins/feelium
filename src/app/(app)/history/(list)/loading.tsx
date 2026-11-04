import { PageHeader } from "@/components/page-header";

/**
 * Lightweight skeleton shown while History loads its day list (PRD 25 - avoid a blank
 * screen on slower connections). Pulse animation is disabled under prefers-reduced-motion
 * via globals.css. Decorative only, so it's hidden from assistive tech.
 */
export default function HistoryLoading() {
  return (
    <>
      <PageHeader title="History" />
      <div className="space-y-3 px-4 pt-2 md:px-8" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 w-full animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading history…
      </span>
    </>
  );
}
