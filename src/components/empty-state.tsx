import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Friendly, non-judgmental empty state (PRD 8.5). An optional `action` renders a CTA (e.g.
 * a deep link to the relevant "add" form) below the description.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
