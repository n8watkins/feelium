import { PageHeader } from "@/components/page-header";
import { BehaviorForm } from "@/components/tracking/behavior-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createBehaviorAction } from "../actions";

export const metadata = { title: "New behavior" };

export default async function NewBehaviorPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  // Only honour an internal path; Today's "Add behavior" affordance passes its own.
  const returnTo = from ? safeRedirectPath(from, "/settings/behaviors") : undefined;
  const backHref = returnTo ?? "/settings/behaviors";
  const backLabel = returnTo === "/today" ? "Today" : "Behaviors";

  return (
    <>
      <PageHeader title="New behavior" backHref={backHref} backLabel={backLabel} />
      <div className="px-4 pb-4 pt-2 md:px-8">
        <BehaviorForm
          action={createBehaviorAction}
          submitLabel="Create behavior"
          returnTo={returnTo}
        />
      </div>
    </>
  );
}
