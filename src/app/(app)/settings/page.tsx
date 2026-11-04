import { auth } from "@/auth";
import { InstallHint } from "@/components/install-hint";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { SettingsGroup, SettingsLink, SettingsRow } from "@/components/settings/settings-list";
import { ThemeControl } from "@/components/settings/theme-control";
import { Button } from "@/components/ui/button";
import { formatReminderTime } from "@/lib/reminders";
import {
  getCurrentProfile,
  listActiveBehaviors,
  listActiveOutcomeMetrics,
  listReminderSettings,
  listTags,
} from "@/server/data";

const SECTIONS = [
  { id: "account", title: "Account" },
  { id: "tracking", title: "What you track" },
  { id: "reminders", title: "Reminders" },
  { id: "preferences", title: "Preferences" },
  { id: "data", title: "Your data" },
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMEZONES = Intl.supportedValuesOf("timeZone");

/** "Exercise, Reading, Coffee and 2 more" */
function names(list: { name: string }[], empty: string): string {
  if (list.length === 0) return empty;
  const shown = list.slice(0, 3).map((item) => item.name).join(", ");
  return list.length > 3 ? `${shown} and ${list.length - 3} more` : shown;
}

/** Settings as one grouped list: account, what you track, reminders, preferences, data. */
export default async function SettingsPage() {
  const session = await auth();
  const [profile, behaviors, outcomes, tags, reminders] = await Promise.all([
    getCurrentProfile(),
    listActiveBehaviors(),
    listActiveOutcomeMetrics(),
    listTags(),
    listReminderSettings(),
  ]);
  const name = session?.user?.name || session?.user?.email || "Your account";
  const image = session?.user?.image;

  return (
    <>
      <PageHeader title="Settings" />
      {/* On laptops a section list sits on the left and stays put while the right side scrolls. */}
      <div data-wide className="px-4 md:px-8 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-24 -ml-3 space-y-1 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex min-h-10 items-center rounded-xl px-3 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      <div className="grid max-w-3xl gap-10">
        <Section id="account" title="Account">
          <SettingsGroup>
            <li className="flex flex-wrap items-center gap-4 px-5 py-4">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" width={48} height={48} className="size-12 rounded-full bg-muted" />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground" aria-hidden="true">
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{name}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  Signed in with GitHub{session?.user?.email ? ` · ${session.user.email}` : ""}
                </span>
              </span>
              <form method="post" action="/api/account/signout">
                <Button type="submit" variant="outline" className="h-9 rounded-full px-4">
                  Log out
                </Button>
              </form>
            </li>
            <SettingsRow title="Every device" detail="Ends sessions on phones and browsers you're not using now">
              <form method="post" action="/api/account/signout-everywhere">
                <Button type="submit" variant="ghost" className="h-9 rounded-full px-4">
                  Log out on every device
                </Button>
              </form>
            </SettingsRow>
          </SettingsGroup>
        </Section>

        <Section id="tracking" title="What you track">
          <SettingsGroup>
            <SettingsLink href="/settings/behaviors" title="Behaviors" detail={names(behaviors, "None yet")} />
            <SettingsLink href="/settings/outcomes" title="Feelings" detail={names(outcomes, "None yet")} />
            <SettingsLink href="/settings/tags" title="Tags" detail={names(tags, "None yet")} />
          </SettingsGroup>
        </Section>

        <Section id="reminders" title="Reminders">
          <div className="space-y-3">
            <SettingsGroup>
              {reminders.map((reminder) => (
                <SettingsRow
                  key={reminder.id}
                  title={formatReminderTime(reminder.reminderTime)}
                  detail={reminder.isEnabled ? "Every day" : "Paused"}
                />
              ))}
              <SettingsLink
                href="/settings/notifications"
                title={reminders.length > 0 ? "Reminders and devices" : "Set up reminders"}
                detail={reminders.length > 0 ? "Add, pause or remove times, and choose devices" : "A gentle nudge at the times you pick"}
              />
            </SettingsGroup>
            <InstallHint context="reminders" />
          </div>
        </Section>

        <Section id="preferences" title="Preferences">
          <SettingsGroup>
            <SettingsRow title="Theme">
              <ThemeControl />
            </SettingsRow>
            <li className="px-5 py-4">
              <p className="mb-3 text-sm text-muted-foreground">Calendar dates and summaries use these.</p>
              <PreferencesForm
                timezone={profile?.timezone ?? "UTC"}
                weekStartsOn={profile?.weekStartsOn ?? 1}
                timezones={TIMEZONES}
                weekdays={WEEKDAYS}
              />
            </li>
          </SettingsGroup>
        </Section>

        <Section id="data" title="Your data">
          <SettingsGroup>
            <SettingsLink href="/api/account/export" prefetch={false} title="Export everything" detail="One JSON file with every entry, note and setting" />
            <SettingsLink href="/settings/privacy" title="How your data is handled" detail="Private to your account. Never sold or used for training." />
            <SettingsLink href="/settings/data" title="Delete data or account" detail="Clear your tracking data, or remove everything" />
          </SettingsGroup>
        </Section>
      </div>
      </div>
    </>
  );
}
