import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { CheckInForm } from "@/components/tracking/check-in-form";
import { getCheckInDetail, listOutcomeMetrics, listTags } from "@/server/data";

export const metadata = { title: "Edit check-in" };

export default async function EditCheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
      <PageHeader title="Edit check-in" backHref="/today" backLabel="Today" />
      <div className="px-4 pb-6 pt-2 md:px-8">
        <CheckInForm
          localDate={detail.checkIn.localDate}
          checkInId={detail.checkIn.id}
          outcomes={outcomes}
          tags={tags.map((t) => ({ id: t.id, name: t.name }))}
          initialAnswers={initialAnswers}
          initialTagIds={detail.tagIds}
          initialNote={detail.checkIn.note ?? ""}
        />
      </div>
    </>
  );
}
