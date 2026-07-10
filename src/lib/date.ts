/**
 * History and daily tracking store calendar dates as ISO 'YYYY-MM-DD' strings (SQLite has
 * no date type). Parse and format them in the *local* calendar to avoid the UTC-shift bug
 * of `new Date("2026-07-09")`, which is parsed as UTC midnight and can render as the
 * previous day in negative-offset timezones.
 */

/** Parses an ISO 'YYYY-MM-DD' string into a local-midnight Date. */
export function parseISODate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Today's local calendar date as 'YYYY-MM-DD'. */
export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** Long, human date: "Wednesday, July 9, 2026". */
export function formatDayFull(date: string): string {
  return parseISODate(date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Compact date: "Wed, Jul 9". */
export function formatDayShort(date: string): string {
  return parseISODate(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "Today"/"Yesterday" for the two most recent days, otherwise null. */
export function relativeDayLabel(date: string): string | null {
  if (date === todayISO()) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === yesterday.toLocaleDateString("en-CA")) return "Yesterday";
  return null;
}

/** Time of day: "8:30 AM". */
export function formatTime(at: Date): string {
  return at.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
