"use client";

import {
  BellOff,
  BellRing,
  Check,
  Loader2,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  createReminderAction,
  deleteReminderAction,
  sendTestNotificationAction,
  subscribeToPushAction,
  unsubscribeFromPushAction,
  updateReminderAction,
} from "@/app/(app)/settings/notifications/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ReminderSchedule, WebPushSubscriptionJSON } from "@/server/data";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

function describeDevice(): string {
  const userAgent = navigator.userAgent;
  const browser = /Edg/.test(userAgent)
    ? "Edge"
    : /Chrome/.test(userAgent)
      ? "Chrome"
      : /Firefox/.test(userAgent)
        ? "Firefox"
        : /Safari/.test(userAgent)
          ? "Safari"
          : "Browser";
  const operatingSystem = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/.test(userAgent)
      ? "iOS"
      : /Mac/.test(userAgent)
        ? "macOS"
        : /Win/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "device";
  return `${browser} on ${operatingSystem}`;
}

function toPayload(
  subscription: PushSubscription,
): WebPushSubscriptionJSON | null {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

function formatReminderTime(value: string): string {
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hour, minute));
}

export function NotificationSettings({
  initialReminders,
  timezone,
  vapidPublicKey,
  pushConfigured,
}: {
  initialReminders: ReminderSchedule[];
  timezone: string;
  vapidPublicKey: string | null;
  pushConfigured: boolean;
}) {
  const [reminders, setReminders] = useState(initialReminders);
  const [adding, setAdding] = useState(false);

  function updateReminder(next: ReminderSchedule) {
    setReminders((current) =>
      current
        .map((reminder) => (reminder.id === next.id ? next : reminder))
        .sort((left, right) =>
          left.reminderTime.localeCompare(right.reminderTime),
        ),
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reminder times</CardTitle>
          <CardDescription>
            Add as many daily check-in reminders as you need. Times use{" "}
            {timezone}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reminders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No reminders yet. Add one whenever a gentle check-in nudge would
              help.
            </div>
          ) : (
            <ul className="space-y-3">
              {reminders.map((reminder) => (
                <ReminderRow
                  key={reminder.id}
                  reminder={reminder}
                  timezone={timezone}
                  onUpdate={updateReminder}
                  onDelete={(id) =>
                    setReminders((current) =>
                      current.filter((reminderItem) => reminderItem.id !== id),
                    )
                  }
                />
              ))}
            </ul>
          )}

          {adding ? (
            <AddReminderForm
              timezone={timezone}
              onCancel={() => setAdding(false)}
              onCreated={(reminder) => {
                setReminders((current) =>
                  [...current, reminder].sort((left, right) =>
                    left.reminderTime.localeCompare(right.reminderTime),
                  ),
                );
                setAdding(false);
              }}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setAdding(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add reminder
            </Button>
          )}
        </CardContent>
      </Card>

      <DeviceNotifications
        vapidPublicKey={vapidPublicKey}
        pushConfigured={pushConfigured}
      />
    </div>
  );
}

function ReminderRow({
  reminder,
  timezone,
  onUpdate,
  onDelete,
}: {
  reminder: ReminderSchedule;
  timezone: string;
  onUpdate: (reminder: ReminderSchedule) => void;
  onDelete: (id: string) => void;
}) {
  const [time, setTime] = useState(reminder.reminderTime);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const dirty = time !== reminder.reminderTime;
  const label = formatReminderTime(reminder.reminderTime);

  async function save(nextEnabled = reminder.isEnabled) {
    if (busy) return false;
    setBusy(true);
    try {
      const result = await updateReminderAction(reminder.id, {
        isEnabled: nextEnabled,
        reminderTime: time,
        timezone,
      });
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      onUpdate({
        ...reminder,
        isEnabled: nextEnabled,
        reminderTime: time,
        timezone,
      });
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await deleteReminderAction(reminder.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDelete(reminder.id);
      toast.success("Reminder deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">
            {reminder.isEnabled ? "Enabled" : "Paused"}
          </p>
        </div>
        <Switch
          checked={reminder.isEnabled}
          disabled={busy}
          onCheckedChange={async (next) => {
            if (await save(next)) {
              toast.success(next ? "Reminder enabled." : "Reminder paused.");
            }
          }}
          aria-label={`${reminder.isEnabled ? "Pause" : "Enable"} ${label} reminder`}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <div className="min-w-40 flex-1 space-y-2">
          <Label htmlFor={`reminder-time-${reminder.id}`}>Time</Label>
          <Input
            id={`reminder-time-${reminder.id}`}
            type="time"
            value={time}
            disabled={busy}
            onChange={(event) => setTime(event.target.value)}
            className="h-11 text-base"
          />
        </div>
        {dirty ? (
          <Button
            type="button"
            className="h-11"
            disabled={busy || !time}
            onClick={async () => {
              if (await save()) toast.success("Reminder time saved.");
            }}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              "Save"
            )}
          </Button>
        ) : null}
        {confirmingDelete ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              disabled={busy}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              disabled={busy}
              onClick={remove}
            >
              Delete
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 text-muted-foreground"
            disabled={busy}
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${label} reminder`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  );
}

function AddReminderForm({
  timezone,
  onCancel,
  onCreated,
}: {
  timezone: string;
  onCancel: () => void;
  onCreated: (reminder: ReminderSchedule) => void;
}) {
  const [time, setTime] = useState("20:00");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (busy || !time) return;
    setBusy(true);
    try {
      const result = await createReminderAction({
        reminderTime: time,
        timezone,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.reminder) onCreated(result.reminder);
      toast.success("Reminder added.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <Label htmlFor="new-reminder-time">New reminder time</Label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          id="new-reminder-time"
          type="time"
          value={time}
          disabled={busy}
          onChange={(event) => setTime(event.target.value)}
          className="h-11 min-w-40 flex-1 text-base"
        />
        <Button
          type="button"
          variant="ghost"
          className="h-11"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="h-11"
          disabled={busy || !time}
          onClick={create}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            "Add"
          )}
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        New reminders start enabled in {timezone}.
      </p>
    </div>
  );
}

function DeviceNotifications({
  vapidPublicKey,
  pushConfigured,
}: {
  vapidPublicKey: string | null;
  pushConfigured: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function detect() {
      const available =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!available) return { supported: false as const };
      let currentSubscription: PushSubscription | null = null;
      try {
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
        if (registration) {
          currentSubscription =
            await registration.pushManager.getSubscription();
        }
      } catch {
        // A missing subscription is represented by null below.
      }
      return {
        supported: true as const,
        permission: Notification.permission,
        subscription: currentSubscription,
      };
    }
    void detect().then((result) => {
      if (cancelled) return;
      setSupported(result.supported);
      if (result.supported) {
        setPermission(result.permission);
        setSubscription(result.subscription);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function setupDevice() {
    if (!pushConfigured || !vapidPublicKey) {
      toast.error("Push notifications aren't configured on the server.");
      return;
    }
    setBusy(true);
    try {
      let nextPermission = Notification.permission;
      if (nextPermission === "default") {
        nextPermission = await Notification.requestPermission();
      }
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        toast.error("Notification permission is needed to set up this device.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      let nextSubscription = await registration.pushManager.getSubscription();
      if (!nextSubscription) {
        nextSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }
      const payload = toPayload(nextSubscription);
      if (!payload) {
        toast.error("Could not read this browser's push subscription.");
        return;
      }
      const result = await subscribeToPushAction(payload, describeDevice());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSubscription(nextSubscription);
      toast.success("This device is ready for reminders.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDevice() {
    if (!subscription || busy) return;
    setBusy(true);
    try {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe().catch(() => false);
      const result = await unsubscribeFromPushAction(endpoint);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSubscription(null);
      toast.success("This device was removed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await sendTestNotificationAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.sent === 1
          ? "Test reminder sent."
          : `Test reminder sent to ${result.sent} devices.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Devices</CardTitle>
        <CardDescription>
          Choose which browsers can receive every enabled reminder on this
          account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DeviceStatus
          ready={ready}
          supported={supported}
          permission={permission}
          pushConfigured={pushConfigured}
          subscribed={Boolean(subscription)}
        />
        {ready && supported ? (
          <div className="flex flex-wrap gap-2">
            {subscription ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={sendTest}
                >
                  Send a test
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={removeDevice}
                >
                  Remove this device
                </Button>
              </>
            ) : (
              <Button
                type="button"
                disabled={busy || !pushConfigured}
                onClick={setupDevice}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <BellRing className="size-4" aria-hidden="true" />
                )}
                Set up this device
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DeviceStatus({
  ready,
  supported,
  permission,
  pushConfigured,
  subscribed,
}: {
  ready: boolean;
  supported: boolean;
  permission: NotificationPermission;
  pushConfigured: boolean;
  subscribed: boolean;
}) {
  if (!ready) {
    return (
      <StatusRow
        icon={
          <Loader2
            className="size-5 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        }
        title="Checking this device"
        detail="Looking for browser notification support."
      />
    );
  }
  if (!pushConfigured) {
    return (
      <StatusRow
        icon={
          <TriangleAlert
            className="size-5 text-muted-foreground"
            aria-hidden="true"
          />
        }
        title="Push isn't configured on the server"
        detail="You can manage reminder times, but devices cannot receive them until push keys are configured."
      />
    );
  }
  if (!supported) {
    return (
      <StatusRow
        icon={
          <BellOff
            className="size-5 text-muted-foreground"
            aria-hidden="true"
          />
        }
        title="Notifications aren't available in this browser"
        detail="Your reminder schedule is still saved and can be delivered to other devices."
      />
    );
  }
  if (permission === "denied") {
    return (
      <StatusRow
        icon={
          <BellOff
            className="size-5 text-muted-foreground"
            aria-hidden="true"
          />
        }
        title="Notifications are blocked"
        detail="Allow notifications in this browser's site settings to set up this device."
      />
    );
  }
  if (subscribed) {
    return (
      <StatusRow
        icon={
          <Check className="size-5 text-muted-foreground" aria-hidden="true" />
        }
        title="This device is ready"
        detail="It will receive every enabled reminder on your account."
      />
    );
  }
  return (
    <StatusRow
      icon={
        <BellRing className="size-5 text-muted-foreground" aria-hidden="true" />
      }
      title="This device is not set up"
      detail="Set it up once to receive all enabled reminders."
    />
  );
}

function StatusRow({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4"
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="space-y-0.5 text-sm">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
