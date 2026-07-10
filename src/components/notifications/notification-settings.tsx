"use client";

import { BellOff, BellRing, Check, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  saveReminderSettingsAction,
  sendTestNotificationAction,
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "@/app/(app)/settings/notifications/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ReminderSettings, WebPushSubscriptionJSON } from "@/server/data";

/** Converts a base64url VAPID key to the Uint8Array the Push API expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** A short, human label for this device, stored alongside the subscription. */
function describeDevice(): string {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /Chrome/.test(ua)
      ? "Chrome"
      : /Firefox/.test(ua)
        ? "Firefox"
        : /Safari/.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Mac/.test(ua)
        ? "macOS"
        : /Win/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "device";
  return `${browser} on ${os}`;
}

function toPayload(sub: PushSubscription): WebPushSubscriptionJSON | null {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

export function NotificationSettings({
  initialSettings,
  vapidPublicKey,
  pushConfigured,
}: {
  initialSettings: ReminderSettings;
  vapidPublicKey: string | null;
  pushConfigured: boolean;
}) {
  // `ready` starts false so the server render and first client render match (no hydration
  // mismatch); the browser-only capability probe runs in the effect below and flips it.
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [enabled, setEnabled] = useState(initialSettings.isEnabled);
  const [time, setTime] = useState(initialSettings.reminderTime ?? "20:00");
  const [timezone, setTimezone] = useState(initialSettings.timezone);
  const [busy, setBusy] = useState(false);
  const [timeDirty, setTimeDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      const isSupported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!isSupported) return { supported: false as const };

      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let sub: PushSubscription | null = null;
      try {
        // Don't hang forever if the service worker never activates.
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
        if (reg) sub = await reg.pushManager.getSubscription();
      } catch {
        /* ignore - treated as not subscribed */
      }
      return { supported: true as const, permission: Notification.permission, detectedTz, sub };
    }

    // setState runs only inside this async continuation (never synchronously in the
    // effect body), which keeps renders from cascading.
    detect().then((result) => {
      if (cancelled) return;
      if (!result.supported) {
        setSupported(false);
        setReady(true);
        return;
      }
      setSupported(true);
      setPermission(result.permission);
      setSubscription(result.sub);
      setTimezone((prev) => (prev && prev !== "UTC" ? prev : result.detectedTz || prev || "UTC"));
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Ensures notification permission and an active push subscription saved server-side. */
  async function ensureSubscribed(): Promise<boolean> {
    if (!pushConfigured || !vapidPublicKey) {
      toast.error("Push notifications aren't configured on the server.");
      return false;
    }
    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
    }
    setPermission(perm);
    if (perm !== "granted") {
      toast.error(
        perm === "denied"
          ? "Notifications are blocked. Allow them in your browser settings to get reminders."
          : "Notification permission is needed to send reminders.",
      );
      return false;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }
    const payload = toPayload(sub);
    if (!payload) {
      toast.error("Could not read the push subscription from this browser.");
      return false;
    }
    const res = await subscribeToPushAction(payload, describeDevice());
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setSubscription(sub);
    return true;
  }

  async function handleToggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        const ok = await ensureSubscribed();
        if (!ok) {
          setEnabled(false);
          return;
        }
        const res = await saveReminderSettingsAction({
          isEnabled: true,
          reminderTime: time,
          timezone,
        });
        if (!res.ok) {
          toast.error(res.error);
          setEnabled(false);
          return;
        }
        setEnabled(true);
        setTimeDirty(false);
        toast.success("Daily reminder on.");
      } else {
        const res = await saveReminderSettingsAction({
          isEnabled: false,
          reminderTime: time,
          timezone,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setEnabled(false);
        toast.success("Daily reminder off.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      setEnabled(initialSettings.isEnabled);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveTime() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await saveReminderSettingsAction({
        isEnabled: enabled,
        reminderTime: time,
        timezone,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setTimeDirty(false);
      toast.success("Reminder time saved.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await ensureSubscribed();
      if (!ok) return;
      const res = await sendTestNotificationAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.sent === 1 ? "Test reminder sent." : `Test reminder sent to ${res.sent} devices.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveDevice() {
    if (busy || !subscription) return;
    setBusy(true);
    try {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe().catch(() => {});
      await unsubscribeFromPushAction(endpoint);
      setSubscription(null);
      toast.success("This device will no longer receive reminders.");
    } finally {
      setBusy(false);
    }
  }

  // Neutral placeholder until the browser capability probe resolves (keeps SSR/CSR in sync).
  if (!ready) {
    return (
      <p role="status" aria-busy="true" className="text-sm text-muted-foreground">
        Checking notification support…
      </p>
    );
  }

  // Graceful fallback: push unavailable in this browser (PRD 23).
  if (!supported) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4"
      >
        <BellOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1 text-sm">
          <p className="font-medium">Reminders aren&apos;t available in this browser</p>
          <p className="text-muted-foreground">
            This browser doesn&apos;t support push notifications. You can still check in
            anytime from the Today screen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PermissionStatus permission={permission} pushConfigured={pushConfigured} />

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="reminder-enabled" className="text-base">
            Daily check-in reminder
          </Label>
          <p className="text-sm text-muted-foreground">
            One gentle nudge a day. Turn it off anytime.
          </p>
        </div>
        <Switch
          id="reminder-enabled"
          checked={enabled}
          disabled={busy}
          onCheckedChange={handleToggle}
          aria-label="Enable daily check-in reminder"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reminder-time">Reminder time</Label>
        <div className="flex items-center gap-2">
          <Input
            id="reminder-time"
            type="time"
            value={time}
            disabled={busy}
            onChange={(e) => {
              setTime(e.target.value);
              setTimeDirty(true);
            }}
            className="h-11 max-w-[10rem] text-base"
          />
          {enabled && timeDirty ? (
            <Button type="button" onClick={handleSaveTime} disabled={busy} className="h-11">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Save"}
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Times are in your device timezone ({timezone}).
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {subscription ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <BellRing className="size-4" aria-hidden="true" />
              This device is set up to receive reminders.
            </span>
          ) : (
            <span className="text-muted-foreground">
              Turn on the reminder to receive it on this device.
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={busy || !pushConfigured}
            className="h-11"
          >
            Send a test
          </Button>
          {subscription ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleRemoveDevice}
              disabled={busy}
              className="h-11"
            >
              Remove this device
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PermissionStatus({
  permission,
  pushConfigured,
}: {
  permission: NotificationPermission;
  pushConfigured: boolean;
}) {
  if (!pushConfigured) {
    return (
      <StatusRow
        icon={<TriangleAlert className="size-5 text-muted-foreground" aria-hidden="true" />}
        title="Push isn't configured on the server"
        detail="Reminders can be set up here, but delivery is unavailable until the server has push keys."
      />
    );
  }
  if (permission === "granted") {
    return (
      <StatusRow
        icon={<Check className="size-5 text-muted-foreground" aria-hidden="true" />}
        title="Notifications allowed"
        detail="Reminders can be delivered to this device."
      />
    );
  }
  if (permission === "denied") {
    return (
      <StatusRow
        icon={<BellOff className="size-5 text-muted-foreground" aria-hidden="true" />}
        title="Notifications blocked"
        detail="You've blocked notifications for this site. Allow them in your browser's site settings to receive reminders. You can still check in anytime."
      />
    );
  }
  return (
    <StatusRow
      icon={<BellRing className="size-5 text-muted-foreground" aria-hidden="true" />}
      title="Notifications not enabled yet"
      detail="Turn on the daily reminder below and your browser will ask permission to send it."
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
