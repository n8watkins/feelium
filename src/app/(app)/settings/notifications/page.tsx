import { PageHeader } from "@/components/page-header";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getReminderSettings } from "@/server/data";
import { isPushConfigured } from "@/server/push/webpush";

export const metadata = { title: "Notifications" };

export default async function NotificationSettingsPage() {
  const settings = await getReminderSettings();
  const pushConfigured = isPushConfigured();
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;

  return (
    <>
      <PageHeader title="Notifications" backHref="/settings" backLabel="Settings" />
      <div className="space-y-6 px-4 pt-2 md:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Daily reminder</CardTitle>
            <CardDescription>
              A single optional daily nudge to check in. You can always check in without one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationSettings
              initialSettings={settings}
              vapidPublicKey={vapidPublicKey}
              pushConfigured={pushConfigured}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
