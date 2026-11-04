import { PageHeader } from "@/components/page-header";
import { OutcomeForm } from "@/components/tracking/outcome-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createOutcomeAction } from "../actions";

export const metadata = { title: "Add a feeling" };

export default async function NewOutcomePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  // Only honour an internal path; the check-in "Add a feeling" link passes its own.
  const returnTo = from ? safeRedirectPath(from, "/settings/outcomes") : undefined;
  const backHref = returnTo ?? "/settings/outcomes";
  const backLabel = returnTo?.startsWith("/checkin")
    ? "Check-in"
    : returnTo?.startsWith("/today")
      ? "Today"
      : "Feelings";

  return (
    <>
      <PageHeader title="Add a feeling" backHref={backHref} backLabel={backLabel} />
      <div className="px-4 pb-4 pt-2 md:px-8">
        <OutcomeForm
          action={createOutcomeAction}
          submitLabel="Add feeling"
          returnTo={returnTo}
        />
      </div>
    </>
  );
}
