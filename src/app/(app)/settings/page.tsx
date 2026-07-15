import {
  Bell,
  ChevronRight,
  CircleCheck,
  Database,
  ShieldCheck,
  SmilePlus,
  Tag,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { auth } from "@/auth";
import { ModeToggle } from "@/components/mode-toggle";
import { PageHeader } from "@/components/page-header";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile } from "@/server/data";
import { signOut } from "./actions";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const TIMEZONES = Intl.supportedValuesOf("timeZone");

const TRACKING_LINKS: {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
}[] = [
  { href: "/settings/behaviors", icon: CircleCheck, label: "Behaviors", description: "What you do" },
  { href: "/settings/outcomes", icon: SmilePlus, label: "Outcomes", description: "How you feel" },
  { href: "/settings/tags", icon: Tag, label: "Tags", description: "Context labels" },
];

export default async function SettingsPage() {
  const session = await auth();
  const profile = await getCurrentProfile();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6 px-4 pt-2 md:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>{session?.user?.email ?? "Signed in"}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signOut}>
              <Button type="submit" variant="outline">
                Log out
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>
              Calendar dates and summaries use these preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Theme</span>
              <ModeToggle />
            </div>
            <PreferencesForm
              timezone={profile?.timezone ?? "UTC"}
              weekStartsOn={profile?.weekStartsOn ?? 1}
              timezones={TIMEZONES}
              weekdays={WEEKDAYS}
            />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Tracking</CardTitle>
            <CardDescription>
              Manage what you track. Reorder items within each list.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <nav>
              {TRACKING_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-14 items-center gap-3 border-t border-border px-6 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <link.icon
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{link.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {link.description}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </nav>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-5 text-muted-foreground" aria-hidden="true" />
              Notifications
            </CardTitle>
            <CardDescription>
              One optional daily reminder to check in.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <nav>
              <Link
                href="/settings/notifications"
                className="flex min-h-14 items-center gap-3 border-t border-border px-6 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="flex-1">
                  <span className="block text-sm font-medium">Daily reminder</span>
                  <span className="block text-xs text-muted-foreground">
                    Enable, set a time, and view permission status
                  </span>
                </span>
                <ChevronRight
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </nav>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5 text-muted-foreground" aria-hidden="true" />
              Data
            </CardTitle>
            <CardDescription>
              Your data is yours. Export it, or delete it anytime.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <nav>
              <Link
                href="/settings/data"
                className="flex min-h-14 items-center gap-3 border-t border-border px-6 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="flex-1">
                  <span className="block text-sm font-medium">Export or delete</span>
                  <span className="block text-xs text-muted-foreground">
                    Download your data, delete tracking data, or delete your account
                  </span>
                </span>
                <ChevronRight
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </nav>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck
                className="size-5 text-muted-foreground"
                aria-hidden="true"
              />
              Privacy
            </CardTitle>
            <CardDescription>
              How feelium keeps your entries private.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <nav>
              <Link
                href="/settings/privacy"
                className="flex min-h-14 items-center gap-3 border-t border-border px-6 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="flex-1">
                  <span className="block text-sm font-medium">Privacy &amp; your data</span>
                  <span className="block text-xs text-muted-foreground">
                    Private by default - no sharing, no selling, no training
                  </span>
                </span>
                <ChevronRight
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </nav>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
