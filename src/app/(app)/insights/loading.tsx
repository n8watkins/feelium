import { PageHeader } from "@/components/page-header";

/**
 * Lightweight skeleton shown while Insights loads its analytics (PRD 25 - avoid a blank
 * screen on slower connections). Pulse animation is disabled under prefers-reduced-motion
 * via globals.css. Decorative only, so it's hidden from assistive tech.
 */
export default function InsightsLoading() {
  return (
    <>
      <PageHeader title="Insights" />
      <div className="space-y-6 px-4 pt-2 md:px-8" aria-hidden="true">
        <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 w-full animate-pulse rounded-xl bg-muted"
          />
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading insights…
      </span>
    </>
  );
}
