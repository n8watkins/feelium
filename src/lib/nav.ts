import { BarChart3, CalendarDays, Home, Settings, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * Primary information architecture, shared by the mobile bottom navigation and the
 * desktop sidebar so both stay in sync (PRD 10.1).
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/history", label: "History", icon: CalendarDays },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];
