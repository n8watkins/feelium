import type { ComponentType, SVGProps } from "react";

import { InsightsIcon, SettingsIcon, TodayIcon } from "@/components/nav-icons";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Other paths that belong to this tab (History and its days live under Today). */
  also?: string[];
};

/**
 * Primary navigation: three tabs, in the desktop top bar and the phone's bottom bar.
 * History folds into Today ("Earlier today", "All days") and Insights (day by day).
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: TodayIcon, also: ["/history", "/checkin"] },
  { href: "/insights", label: "Insights", icon: InsightsIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function isActiveTab(item: NavItem, pathname: string): boolean {
  return [item.href, ...(item.also ?? [])].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
