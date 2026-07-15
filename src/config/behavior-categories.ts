export const BEHAVIOR_CATEGORY_COLORS = [
  "blue",
  "teal",
  "green",
  "amber",
  "orange",
  "red",
  "pink",
  "purple",
  "indigo",
  "slate",
] as const;

export type BehaviorCategoryColor = (typeof BEHAVIOR_CATEGORY_COLORS)[number];

export function isBehaviorCategoryColor(value: string): value is BehaviorCategoryColor {
  return BEHAVIOR_CATEGORY_COLORS.some((color) => color === value);
}

export function normalizeBehaviorCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}
