import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { BehaviorForm } from "@/components/tracking/behavior-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import {
  behaviorHasEntries,
  getBehavior,
  listBehaviorCategories,
} from "@/server/data";
import { updateBehaviorAction } from "../actions";

export const metadata = { title: "Edit behavior" };

export default async function EditBehaviorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const behavior = await getBehavior(id);
  if (!behavior) notFound();

  const [lockInputType, categories] = await Promise.all([
    behaviorHasEntries(id),
    listBehaviorCategories(),
  ]);
  const returnTo = from
    ? safeRedirectPath(from, "/settings/behaviors")
    : undefined;
  const backHref = returnTo ?? "/settings/behaviors";
  const backLabel = returnTo === "/today" ? "Today" : "Behaviors";

  return (
    <>
      <PageHeader
        title="Edit behavior"
        backHref={backHref}
        backLabel={backLabel}
      />
      <div className="px-4 pb-4 pt-2 md:px-8">
        <BehaviorForm
          action={updateBehaviorAction}
          submitLabel="Save changes"
          behaviorId={behavior.id}
          lockInputType={lockInputType}
          categories={categories}
          returnTo={returnTo}
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
