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

export const BEHAVIOR_CATEGORY_COLOR_LABELS: Record<BehaviorCategoryColor, string> = {
  blue: "Blue",
  teal: "Teal",
  green: "Green",
  amber: "Amber",
  orange: "Orange",
  red: "Red",
  pink: "Pink",
  purple: "Purple",
  indigo: "Indigo",
  slate: "Slate",
};

export const BEHAVIOR_CATEGORY_COLOR_STYLES: Record<
  BehaviorCategoryColor,
  { badge: string; swatch: string; accent: string }
> = {
  blue: {
    badge: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
    swatch: "bg-blue-600 dark:bg-blue-400",
    accent: "border-blue-500",
  },
  teal: {
    badge: "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200",
    swatch: "bg-teal-600 dark:bg-teal-400",
    accent: "border-teal-500",
  },
  green: {
    badge: "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
    swatch: "bg-green-600 dark:bg-green-400",
    accent: "border-green-500",
  },
  amber: {
    badge: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    swatch: "bg-amber-500 dark:bg-amber-400",
    accent: "border-amber-500",
  },
  orange: {
    badge: "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
    swatch: "bg-orange-600 dark:bg-orange-400",
    accent: "border-orange-500",
  },
  red: {
    badge: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
    swatch: "bg-red-600 dark:bg-red-400",
    accent: "border-red-500",
  },
  pink: {
    badge: "border-pink-300 bg-pink-50 text-pink-800 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-200",
    swatch: "bg-pink-600 dark:bg-pink-400",
    accent: "border-pink-500",
  },
  purple: {
    badge: "border-purple-300 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200",
    swatch: "bg-purple-600 dark:bg-purple-400",
    accent: "border-purple-500",
  },
  indigo: {
    badge: "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
    swatch: "bg-indigo-600 dark:bg-indigo-400",
    accent: "border-indigo-500",
  },
  slate: {
    badge: "border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
    swatch: "bg-slate-600 dark:bg-slate-400",
    accent: "border-slate-500",
  },
};

export function isBehaviorCategoryColor(value: string): value is BehaviorCategoryColor {
  return BEHAVIOR_CATEGORY_COLORS.some((color) => color === value);
}

export function normalizeBehaviorCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}
