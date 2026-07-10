import { Archive } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/** Marks a metric that has been archived but still contributes to history (PRD 16.6). */
export function ArchivedBadge() {
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Archive className="size-3" aria-hidden="true" />
      Archived
    </Badge>
  );
}
