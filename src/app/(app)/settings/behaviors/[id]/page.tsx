import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { BehaviorForm } from "@/components/tracking/behavior-form";
import { behaviorHasEntries, getBehavior, listBehaviorCategories } from "@/server/data";
import { updateBehaviorAction } from "../actions";

export const metadata = { title: "Edit behavior" };

export default async function EditBehaviorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const behavior = await getBehavior(id);
  if (!behavior) notFound();

  const [lockInputType, categories] = await Promise.all([
    behaviorHasEntries(id),
    listBehaviorCategories(),
  ]);

  return (
    <>
      <PageHeader
        title="Edit behavior"
        backHref="/settings/behaviors"
        backLabel="Behaviors"
      />
      <div className="px-4 pb-4 pt-2 md:px-8">
        <BehaviorForm
          action={updateBehaviorAction}
          submitLabel="Save changes"
          behaviorId={behavior.id}
          lockInputType={lockInputType}
          categories={categories}
          defaults={{
            categoryId: behavior.categoryId ?? undefined,
            name: behavior.name,
            inputType: behavior.inputType,
            desiredDirection: behavior.desiredDirection,
            unit: behavior.unit ?? undefined,
            description: behavior.description ?? undefined,
            customPrompt: behavior.customPrompt ?? undefined,
          }}
        />
      </div>
    </>
  );
}
