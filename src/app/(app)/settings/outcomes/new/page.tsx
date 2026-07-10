import { PageHeader } from "@/components/page-header";
import { OutcomeForm } from "@/components/tracking/outcome-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createOutcomeAction } from "../actions";

export const metadata = { title: "New outcome" };

export default async function NewOutcomePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  // Only honour an internal path; the check-in "Add outcome" affordance passes its own.
  const returnTo = from ? safeRedirectPath(from, "/settings/outcomes") : undefined;
  const backHref = returnTo ?? "/settings/outcomes";
  const backLabel = returnTo?.startsWith("/checkin") ? "Check in" : "Outcomes";

  return (
    <>
      <PageHeader title="New outcome" backHref={backHref} backLabel={backLabel} />
      <div className="px-4 pb-4 pt-2 md:px-8">
        <OutcomeForm
          action={createOutcomeAction}
          submitLabel="Create outcome"
          returnTo={returnTo}
        />
      </div>
    </>
  );
}
