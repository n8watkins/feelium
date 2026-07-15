import { PageHeader } from "@/components/page-header";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { DEFAULT_TIME_ZONE } from "@/lib/date";
import { getCurrentProfile, listReminderSettings } from "@/server/data";
import { isPushConfigured } from "@/server/push/webpush";

export const metadata = { title: "Notifications" };

export default async function NotificationSettingsPage() {
  const [reminders, profile] = await Promise.all([
    listReminderSettings(),
    getCurrentProfile(),
  ]);
  const pushConfigured = isPushConfigured();
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;

  return (
    <>
      <PageHeader
        title="Notifications"
        backHref="/settings"
        backLabel="Settings"
      />
      <div className="space-y-6 px-4 pt-2 md:px-8">
        <NotificationSettings
          initialReminders={reminders}
          timezone={profile?.timezone ?? DEFAULT_TIME_ZONE}
          vapidPublicKey={vapidPublicKey}
          pushConfigured={pushConfigured}
        />
      </div>
    </>
  );
}
