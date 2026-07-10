import { PageHeader } from "@/components/page-header";
import { OutcomeForm } from "@/components/tracking/outcome-form";
import { createOutcomeAction } from "../actions";

export const metadata = { title: "New outcome" };

export default function NewOutcomePage() {
  return (
    <>
      <PageHeader title="New outcome" backHref="/settings/outcomes" backLabel="Outcomes" />
      <div className="px-4 pb-4 pt-2 md:px-8">
        <OutcomeForm action={createOutcomeAction} submitLabel="Create outcome" />
      </div>
    </>
  );
}
