import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { CheckInForm } from "@/components/tracking/check-in-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getCheckInDetail, listOutcomeMetrics, listTags } from "@/server/data";

export const metadata = { title: "Edit check-in" };

export default async function EditCheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  // Only accept an internal path; History passes the day it was launched from.
  const returnTo = from ? safeRedirectPath(from, "/today") : "/today";
  const fromHistory = returnTo.startsWith("/history");
  const [detail, allOutcomes, tags] = await Promise.all([
    getCheckInDetail(id),
    listOutcomeMetrics(),
    listTags(),
  ]);
  if (!detail) notFound();

  const initialAnswers: Record<
    string,
    { rating: number | null; boolean: boolean | null; numeric: number | null }
  > = {};
  for (const value of detail.values) {
    initialAnswers[value.outcomeMetricId] = {
      rating: value.ratingValue,
      boolean: value.booleanValue,
      numeric: value.numericValue,
    };
  }

  // Show active outcomes plus any (possibly archived) outcome already recorded here.
  const recordedIds = new Set(detail.values.map((v) => v.outcomeMetricId));
  const outcomes = allOutcomes
    .filter((o) => o.isActive || recordedIds.has(o.id))
    .map((o) => ({
      id: o.id,
      name: o.name,
      inputType: o.inputType,
      unit: o.unit,
    }));

  return (
    <>
      <PageHeader
        title="Edit check-in"
        backHref={returnTo}
        backLabel={fromHistory ? "Day" : "Today"}
      />
      <div className="px-4 pb-6 pt-2 md:px-8">
        <CheckInForm
          localDate={detail.checkIn.localDate}
          checkInId={detail.checkIn.id}
          outcomes={outcomes}
          tags={tags.map((t) => ({ id: t.id, name: t.name }))}
          initialAnswers={initialAnswers}
          initialTagIds={detail.tagIds}
          initialNote={detail.checkIn.note ?? ""}
          returnTo={fromHistory ? returnTo : undefined}
        />
      </div>
    </>
  );
}
