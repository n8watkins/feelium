import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { users } from "./auth";

/**
 * Application schema (PRD section 22), mapped to SQLite/libSQL.
 *
 * Key rules preserved from the PRD:
 *   - "Unknown is never zero": every recorded value column (boolean_value, numeric_value,
 *     rating_value) is NULLABLE with no default, so an explicit No/0 is distinct from
 *     "not recorded" (absence of a row, or a NULL column).
 *   - Authorization is app-layer (there is no RLS in SQLite): every user-owned table
 *     carries user_id and all access is scoped by the authenticated session user via the
 *     central data-access module.
 *   - Enum-like columns are text with a TypeScript union type plus a CHECK constraint,
 *     replacing the Postgres enums from the original design.
 */

// Shared timestamp column builders (application-side defaults; raw SQL writes bypass them).
const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

export type BehaviorInputType = "boolean" | "numeric";
export type BehaviorDirection = "increase" | "reduce" | "neutral";
export type OutcomeInputType = "rating" | "boolean" | "numeric";
export type OutcomeDirection = "higher_is_better" | "lower_is_better" | "neutral";

// profiles: one row per user, created app-side on the first authenticated request
// (replaces the old Postgres trigger). week_starts_on: 0 = Sunday ... 6 = Saturday.
export const profiles = sqliteTable(
  "profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    timezone: text("timezone").notNull().default("UTC"),
    // Existing profiles default to manual control during migration. Newly created profiles
    // opt in explicitly, until the user saves a timezone preference themselves.
    autoSyncTimezone: integer("auto_sync_timezone", { mode: "boolean" })
      .notNull()
      .default(false),
    weekStartsOn: integer("week_starts_on").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("profile_week_starts_on_ck", sql`${t.weekStartsOn} between 0 and 6`)],
);

export const behaviors = sqliteTable(
  "behavior",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    inputType: text("input_type").$type<BehaviorInputType>().notNull(),
    desiredDirection: text("desired_direction").$type<BehaviorDirection>().notNull(),
    unit: text("unit"),
    customPrompt: text("custom_prompt"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
  },
  (t) => [
    index("behavior_user_sort_idx").on(t.userId, t.sortOrder),
    check("behavior_input_type_ck", sql`${t.inputType} in ('boolean', 'numeric')`),
    check(
      "behavior_direction_ck",
      sql`${t.desiredDirection} in ('increase', 'reduce', 'neutral')`,
    ),
  ],
);

export const dailyBehaviorEntries = sqliteTable(
  "daily_behavior_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    behaviorId: text("behavior_id")
      .notNull()
      .references(() => behaviors.id, { onDelete: "cascade" }),
    // Calendar date as ISO 'YYYY-MM-DD' (SQLite has no date type).
    entryDate: text("entry_date").notNull(),
    // Exactly one is used per entry, per the behavior's input type. Both nullable, never
    // defaulted: an explicit No/0 stays distinct from "not recorded".
    booleanValue: integer("boolean_value", { mode: "boolean" }),
    numericValue: real("numeric_value"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One entry per behavior per user per calendar date (PRD 22).
    unique("daily_behavior_entry_unique_per_day").on(
      t.userId,
      t.behaviorId,
      t.entryDate,
    ),
    index("daily_behavior_entry_user_date_idx").on(t.userId, t.entryDate),
  ],
);

export const outcomeMetrics = sqliteTable(
  "outcome_metric",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    inputType: text("input_type").$type<OutcomeInputType>().notNull(),
    // Optional interpretation hint only (PRD 14.1).
    desiredDirection: text("desired_direction").$type<OutcomeDirection>(),
    unit: text("unit"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
  },
  (t) => [
    index("outcome_metric_user_sort_idx").on(t.userId, t.sortOrder),
    check(
      "outcome_metric_input_type_ck",
      sql`${t.inputType} in ('rating', 'boolean', 'numeric')`,
    ),
    check(
      "outcome_metric_direction_ck",
      sql`${t.desiredDirection} is null or ${t.desiredDirection} in ('higher_is_better', 'lower_is_better', 'neutral')`,
    ),
  ],
);

export const checkIns = sqliteTable(
  "check_in",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    occurredAt: integer("occurred_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    // The user's local calendar date, so grouping stays correct across midnight and
    // timezone changes (PRD 23). ISO 'YYYY-MM-DD'.
    localDate: text("local_date").notNull(),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("check_in_user_local_date_idx").on(t.userId, t.localDate),
    index("check_in_user_occurred_idx").on(t.userId, t.occurredAt),
  ],
);

export const checkInValues = sqliteTable(
  "check_in_value",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkInId: text("check_in_id")
      .notNull()
      .references(() => checkIns.id, { onDelete: "cascade" }),
    outcomeMetricId: text("outcome_metric_id")
      .notNull()
      .references(() => outcomeMetrics.id, { onDelete: "cascade" }),
    // One column is populated per the metric's input type. All nullable, never defaulted.
    ratingValue: integer("rating_value"),
    booleanValue: integer("boolean_value", { mode: "boolean" }),
    numericValue: real("numeric_value"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One value per outcome metric per check-in (PRD 22).
    unique("check_in_value_unique_per_metric").on(t.checkInId, t.outcomeMetricId),
    index("check_in_value_metric_idx").on(t.outcomeMetricId),
    check(
      "check_in_value_rating_range_ck",
      sql`${t.ratingValue} is null or ${t.ratingValue} between 1 and 5`,
    ),
  ],
);

export const tags = sqliteTable(
  "tag",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("tag_unique_name_per_user").on(t.userId, t.name)],
);

export const checkInTags = sqliteTable(
  "check_in_tag",
  {
    checkInId: text("check_in_id")
      .notNull()
      .references(() => checkIns.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.checkInId, t.tagId] }),
    index("check_in_tag_tag_idx").on(t.tagId),
  ],
);

export const reminderSettings = sqliteTable(
  "reminder_setting",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // One optional daily reminder per user.
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(false),
    // Local time-of-day 'HH:MM' for the single daily reminder.
    reminderTime: text("reminder_time"),
    timezone: text("timezone").notNull().default("UTC"),
    // The local calendar date most recently completed by the send job.
    lastSentLocalDate: text("last_sent_local_date"),
    deliveryLocalDate: text("delivery_local_date"),
    deliveryLeaseToken: text("delivery_lease_token"),
    deliveryLeaseExpiresAt: integer("delivery_lease_expires_at", {
      mode: "timestamp",
    }),
    // Persisting the next UTC occurrence lets cron read only users who might be due.
    nextReminderAt: integer("next_reminder_at", { mode: "timestamp" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("reminder_setting_due_idx").on(t.isEnabled, t.nextReminderAt)],
);

export const pushSubscriptions = sqliteTable(
  "push_subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    // Full PushSubscription payload (keys, etc.).
    subscriptionData: text("subscription_data", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    deviceName: text("device_name"),
    createdAt: createdAt(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    lastReminderLocalDate: text("last_reminder_local_date"),
    lastReminderAttemptAt: integer("last_reminder_attempt_at", {
      mode: "timestamp",
    }),
  },
  (t) => [
    unique("push_subscription_unique_endpoint").on(t.userId, t.endpoint),
    index("push_subscription_reminder_delivery_idx").on(
      t.userId,
      t.lastReminderLocalDate,
      t.lastReminderAttemptAt,
    ),
  ],
);
