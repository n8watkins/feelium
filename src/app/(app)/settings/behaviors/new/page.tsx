import { PageHeader } from "@/components/page-header";
import { BehaviorForm } from "@/components/tracking/behavior-form";
import { createBehaviorAction } from "../actions";

export const metadata = { title: "New behavior" };

export default function NewBehaviorPage() {
  return (
    <>
      <PageHeader title="New behavior" backHref="/settings/behaviors" backLabel="Behaviors" />
      <div className="px-4 pb-4 pt-2 md:px-8">
        <BehaviorForm action={createBehaviorAction} submitLabel="Create behavior" />
      </div>
    </>
  );
}
