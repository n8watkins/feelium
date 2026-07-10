import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function HistoryPage() {
  return (
    <>
      <PageHeader
        title="History"
        description="Review previous days without pressure about missed ones."
      />
      <div className="px-4 pt-2 md:px-8">
        <EmptyState
          icon={CalendarDays}
          title="No history yet"
          description="Once you start recording, your days appear here in reverse chronological order - behaviors, check-ins, tags, and notes, all editable."
        />
      </div>
    </>
  );
}
