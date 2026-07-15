import { addDaysISO, dateISOInTimeZone, isValidTimeZone } from "@/lib/date";

type LocalParts = {
  date: string;
  time: string;
  scalar: number;
};

export type ReminderEvaluation = {
  due: boolean;
  localDate: string;
  nextAt: Date;
};

function assertValidReminderTime(reminderTime: string): void {
  const match = /^(\d{2}):(\d{2})$/.exec(reminderTime);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new Error("INVALID_REMINDER_TIME");
  }
}

function localParts(value: Date, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = read("year");
  const month = read("month");
  const day = read("day");
  const hour = read("hour");
  const minute = read("minute");
  return {
    date: `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
    time: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
    scalar: Date.UTC(year, month - 1, day, hour, minute),
  };
}

/** Converts one local calendar date and wall-clock time into an actual instant. */
export function reminderOccurrence(
  localDate: string,
  reminderTime: string,
  timezone: string,
): Date {
  if (!isValidTimeZone(timezone)) throw new Error("INVALID_TIMEZONE");
  assertValidReminderTime(reminderTime);
  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = reminderTime.split(":").map(Number);
  const targetScalar = Date.UTC(year, month - 1, day, hour, minute);

  let candidate = new Date(targetScalar);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const difference = targetScalar - localParts(candidate, timezone).scalar;
    candidate = new Date(candidate.getTime() + difference);
    if (difference === 0) break;
  }

  const resolved = localParts(candidate, timezone);
  if (resolved.date === localDate && resolved.time === reminderTime) {
    let earliest = candidate;
    for (let hours = 1; hours <= 3; hours += 1) {
      const earlier = new Date(candidate.getTime() - hours * 60 * 60_000);
      const parts = localParts(earlier, timezone);
      if (parts.date === localDate && parts.time === reminderTime) earliest = earlier;
    }
    return earliest;
  }

  // A skipped spring-transition time has no exact instant. Use the first valid local
  // minute after it so a configured reminder is delayed instead of dropped that day.
  const start = candidate.getTime() - 3 * 60 * 60_000;
  const end = candidate.getTime() + 3 * 60 * 60_000;
  for (let at = start; at <= end; at += 60_000) {
    const parts = localParts(new Date(at), timezone);
    if (parts.date === localDate && parts.time >= reminderTime) return new Date(at);
  }

  throw new Error("UNRESOLVABLE_REMINDER_TIME");
}

/** The next daily reminder occurrence strictly after the supplied instant. */
export function nextReminderAt(
  reminderTime: string,
  timezone: string,
  after: Date = new Date(),
): Date {
  const localDate = dateISOInTimeZone(after, timezone);
  const today = reminderOccurrence(localDate, reminderTime, timezone);
  if (today.getTime() > after.getTime()) return today;
  return reminderOccurrence(addDaysISO(localDate, 1), reminderTime, timezone);
}

export function evaluateReminder(
  reminderTime: string,
  timezone: string,
  now: Date,
  windowMinutes: number,
): ReminderEvaluation {
  if (!isValidTimeZone(timezone)) throw new Error("INVALID_TIMEZONE");
  assertValidReminderTime(reminderTime);
  const today = dateISOInTimeZone(now, timezone);
  const todayOccurrence = reminderOccurrence(today, reminderTime, timezone);
  const localDate = todayOccurrence.getTime() <= now.getTime() ? today : addDaysISO(today, -1);
  const occurrence =
    localDate === today
      ? todayOccurrence
      : reminderOccurrence(localDate, reminderTime, timezone);
  const elapsed = now.getTime() - occurrence.getTime();
  return {
    due: elapsed >= 0 && elapsed < windowMinutes * 60_000,
    localDate,
    nextAt: nextReminderAt(reminderTime, timezone, now),
  };
}
