import { Download, Trash2, TriangleAlert } from "lucide-react";

import { auth } from "@/auth";
import { ConfirmDeleteDialog } from "@/components/settings/confirm-delete-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  deleteAccountAction,
  deleteAllTrackingDataAction,
} from "./actions";

export const metadata = { title: "Data" };

export default async function DataSettingsPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  // Strong, GitHub-style confirmation: the user retypes their own email to delete the
  // account. Falls back to a clear phrase if the account has no email on file.
  const accountPhrase = email ?? "delete my account";

  return (
    <>
      <PageHeader title="Data" backHref="/settings" backLabel="Settings" />
      <div className="space-y-6 px-4 pt-2 md:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="size-5 text-muted-foreground" aria-hidden="true" />
              Export your data
            </CardTitle>
            <CardDescription>
              Download everything you&apos;ve recorded - behaviors, check-ins, outcomes,
              tags, notes, and settings - as a single JSON file. It&apos;s yours to keep.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <a href="/api/account/export" download>
                <Download aria-hidden="true" />
                Export my data (JSON)
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TriangleAlert
                className="size-5 text-destructive"
                aria-hidden="true"
              />
              Delete all tracking data
            </CardTitle>
            <CardDescription>
              Permanently removes every behavior, check-in, outcome, tag, note, reminder,
              and device - but keeps your account, so you start fresh with an empty
              tracker. This can&apos;t be undone. Consider exporting first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmDeleteDialog
              trigger={
                <Button variant="destructive">
                  <Trash2 aria-hidden="true" />
                  Delete all tracking data
                </Button>
              }
              title="Delete all tracking data?"
              description="This permanently removes everything you've recorded. Your account stays, but the data can't be recovered."
              confirmPhrase="DELETE"
              confirmHint={
                <>
                  Type <span className="font-mono font-semibold">DELETE</span> to confirm
                </>
              }
              confirmLabel="Delete data"
              pendingLabel="Deleting…"
              action={deleteAllTrackingDataAction}
            />
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TriangleAlert
                className="size-5 text-destructive"
                aria-hidden="true"
              />
              Delete account
            </CardTitle>
            <CardDescription>
              Permanently deletes your account along with all of your data, and signs you
              out. You won&apos;t be able to sign back in with this account. This can&apos;t
              be undone. Consider exporting first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmDeleteDialog
              trigger={
                <Button variant="destructive">
                  <Trash2 aria-hidden="true" />
                  Delete account
                </Button>
              }
              title="Delete your account?"
              description="This permanently deletes your account and everything in it, then signs you out. It can't be undone."
              confirmPhrase={accountPhrase}
              confirmHint={
                <>
                  Type <span className="font-mono font-semibold">{accountPhrase}</span> to
                  confirm
                </>
              }
              confirmLabel="Delete account"
              pendingLabel="Deleting…"
              action={deleteAccountAction}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
