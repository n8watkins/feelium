import { type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Friendly, non-judgmental empty state (PRD 8.5). Used by placeholder screens until the
 * feature phases fill them in.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
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
      </CardContent>
    </Card>
  );
}
