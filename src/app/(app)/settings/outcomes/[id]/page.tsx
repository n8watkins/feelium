import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { OutcomeForm } from "@/components/tracking/outcome-form";
import { countOutcomeMetricAnswers, getOutcomeMetric } from "@/server/data";
import { updateOutcomeAction } from "../actions";

export const metadata = { title: "Edit feeling" };

export default async function EditOutcomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const outcome = await getOutcomeMetric(id);
  if (!outcome) notFound();

  const lockInputType = (await countOutcomeMetricAnswers(id)) > 0;

  return (
    <>
      <PageHeader title={`Edit ${outcome.name}`} backHref="/settings/outcomes" backLabel="Feelings" />
      <div className="px-4 pb-4 pt-2 md:px-8">
        <OutcomeForm
          action={updateOutcomeAction}
          submitLabel="Save changes"
          outcomeId={outcome.id}
          lockInputType={lockInputType}
          defaults={{
            name: outcome.name,
            inputType: outcome.inputType,
            desiredDirection: outcome.desiredDirection ?? undefined,
            unit: outcome.unit ?? undefined,
            description: outcome.description ?? undefined,
          }}
        />
      </div>
    </>
  );
}
