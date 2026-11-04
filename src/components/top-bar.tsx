"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "@/components/account-menu";
import { BrandMark } from "@/components/brand-mark";
import { branding } from "@/config/branding";
import { isActiveTab, NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * The app's top bar: the mark, the three tabs and Check in on desktop; the mark and the
 * account menu on phones (tabs sit at the bottom there). It clears the notch when installed.
 */
export function TopBar({ account }: { account: { name: string; email: string | null; image: string | null } }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-8 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] md:px-8">
        <Link
          href="/today"
          className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandMark className="h-5" />
          {branding.appName}
        </Link>
        <nav aria-label="Primary" className="hidden h-full items-stretch gap-6 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActiveTab(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center border-b-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/today#checkin"
          className="ml-auto hidden h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:inline-flex"
        >
          Check in
        </Link>
        <AccountMenu {...account} />
      </div>
    </header>
  );
}
