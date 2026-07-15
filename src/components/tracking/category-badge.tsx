import { Badge } from "@/components/ui/badge";
import {
  BEHAVIOR_CATEGORY_COLOR_STYLES,
  type BehaviorCategoryColor,
} from "@/config/behavior-categories";
import { cn } from "@/lib/utils";

export function CategoryBadge({
  name,
  color,
  className,
}: {
  name: string;
  color: BehaviorCategoryColor;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(BEHAVIOR_CATEGORY_COLOR_STYLES[color].badge, className)}
    >
      <span
        className={cn("size-1.5 rounded-full", BEHAVIOR_CATEGORY_COLOR_STYLES[color].swatch)}
        aria-hidden="true"
      />
      {name}
    </Badge>
  );
}
