import { BarChart3 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function InsightsPage() {
  return (
    <>
      <PageHeader
        title="Insights"
        description="Plain-language patterns based on your recorded data."
      />
      <div className="px-4 pt-2 md:px-8">
        <EmptyState
          icon={BarChart3}
          title="Not enough data yet"
          description="Insights compare how you felt on days a behavior did or did not occur. They appear once enough days are recorded - never as causal or medical claims."
        />
      </div>
    </>
  );
}
