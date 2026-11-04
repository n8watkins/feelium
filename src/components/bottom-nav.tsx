"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActiveTab, NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * The phone's bottom tab bar: three tabs, 64px tall above the home indicator
 * (safe-area padding), hidden from md up where the top bar holds the tabs.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {NAV_ITEMS.map((item) => {
          const active = isActiveTab(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="size-[22px]" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
