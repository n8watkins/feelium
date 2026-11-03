import {
  Ban,
  Download,
  Lock,
  Server,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { branding } from "@/config/branding";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Lock,
    title: "Private by default",
    body: "Everything you record is private to your account. There are no public profiles and no public sharing links - nothing you track is visible to anyone else.",
  },
  {
    icon: UserRoundCheck,
    title: "Only you can see your records",
    body: `Every request is scoped to your account, so ${branding.appName} only ever loads and saves your own data. One person's entries are never mixed with another's.`,
  },
  {
    icon: Download,
    title: "Your data is yours",
    body: "You can export a complete copy of your data at any time, and delete your tracking data or your whole account whenever you want. It's your record to keep or remove.",
  },
  {
    icon: Ban,
    title: "Never sold, never used for training",
    body: `We don't sell your personal tracking data, and we don't use your entries to train public AI models. ${branding.appName} exists to help you understand yourself, not to monetize what you record.`,
  },
  {
    icon: Server,
    title: "Where your data lives",
    body: `${branding.appName} runs on Cloudflare Workers and stores your records in a Turso database. Sign-in goes through GitHub, which shares your name, email address and profile picture. Reminders reach your device through your browser's push service, and they carry only the reminder text, never your entries.`,
  },
  {
    icon: ShieldCheck,
    title: "Secure sign-in and encrypted transport",
    body: "Sign-in is handled through secure authentication, and all traffic between your device and the server travels over an encrypted (HTTPS) connection.",
  },
];

/** The privacy explainer, shown in Settings and on the public /privacy page. */
export function PrivacyCard({ dataHref = "/settings/data" }: { dataHref?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your privacy</CardTitle>
        <CardDescription>
          {branding.appName} can hold sensitive things - your moods, habits, health,
          and routines. Here&apos;s how we keep that private, in plain language.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="space-y-5">
          {POINTS.map((point) => (
            <li key={point.title} className="flex gap-3">
              <span
                className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                aria-hidden="true"
              >
                <point.icon className="size-5" />
              </span>
              <div className="space-y-1">
                <h2 className="text-sm font-medium">{point.title}</h2>
                <p className="text-sm text-muted-foreground">{point.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="border-t border-border pt-4 text-sm text-muted-foreground">
          You can export or delete your data anytime from{" "}
          <Link
            href={dataHref}
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            Settings &rsaquo; Data
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
