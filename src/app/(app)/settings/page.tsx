import { Bell, Database, ListChecks } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6 px-4 pt-2 md:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>{user?.email ?? "Signed in"}</CardDescription>
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
              Appearance now; timezone and start of week arrive with tracking setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-sm font-medium">Theme</span>
            <ModeToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-5 text-muted-foreground" aria-hidden="true" />
              Tracking
            </CardTitle>
            <CardDescription>
              Manage behaviors, outcomes, and tags. Available in the tracking-setup phase.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-5 text-muted-foreground" aria-hidden="true" />
              Notifications
            </CardTitle>
            <CardDescription>
              One optional daily reminder. Available in the notifications phase.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5 text-muted-foreground" aria-hidden="true" />
              Data
            </CardTitle>
            <CardDescription>
              Export or delete your data. Available in the release-polish phase.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}
