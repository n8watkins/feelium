/**
 * History and daily tracking store calendar dates as ISO 'YYYY-MM-DD' strings (SQLite has
 * no date type). Parse and format them in the *local* calendar to avoid the UTC-shift bug
 * of `new Date("2026-07-09")`, which is parsed as UTC midnight and can render as the
 * previous day in negative-offset timezones.
 */

export const DEFAULT_TIME_ZONE = "UTC";

/** True when Intl recognizes the value as an IANA timezone. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

/** Parses an ISO calendar date at UTC noon, avoiding DST and host-timezone shifts. */
export function parseISODate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12));
}

/** A timestamp's calendar date as 'YYYY-MM-DD' in the requested timezone. */
export function dateISOInTimeZone(
  date: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Today's calendar date in the user's timezone. */
export function todayISO(timeZone: string = DEFAULT_TIME_ZONE): string {
  return dateISOInTimeZone(new Date(), timeZone);
}

/** Adds calendar days without depending on the server's timezone or DST boundary. */
export function addDaysISO(date: string, delta: number): string {
  const value = parseISODate(date);
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0, 10);
}

/** The ISO date that begins the containing week. 0 = Sunday ... 6 = Saturday. */
export function startOfWeekISO(date: string, weekStartsOn: number): string {
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    throw new RangeError("weekStartsOn must be an integer from 0 through 6");
  }
  const weekday = parseISODate(date).getUTCDay();
  return addDaysISO(date, -((weekday - weekStartsOn + 7) % 7));
}

/** Long, human date: "Wednesday, July 9, 2026". */
export function formatDayFull(date: string): string {
  return parseISODate(date).toLocaleDateString(undefined, {
    timeZone: DEFAULT_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Compact date: "Wed, Jul 9". */
export function formatDayShort(date: string): string {
  return parseISODate(date).toLocaleDateString(undefined, {
    timeZone: DEFAULT_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "Today"/"Yesterday" for the two most recent days, otherwise null. */
export function relativeDayLabel(
  date: string,
  timeZone: string = DEFAULT_TIME_ZONE,
): string | null {
  const today = todayISO(timeZone);
  if (date === today) return "Today";
  if (date === addDaysISO(today, -1)) return "Yesterday";
  return null;
}

/** Time of day: "8:30 AM". */
export function formatTime(
  at: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  return at.toLocaleTimeString(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
}
