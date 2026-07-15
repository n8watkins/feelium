import type { BatchItem } from "drizzle-orm/batch";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { asc, eq, inArray } from "drizzle-orm";

import * as schema from "@/db/schema";
import {
  accounts,
  behaviorCategories,
  behaviors,
  checkInTags,
  checkInValues,
  checkIns,
  dailyBehaviorEntries,
  outcomeMetrics,
  profiles,
  pushSubscriptions,
  reminderSettings,
  sessions,
  tags,
  users,
} from "@/db/schema";

/**
 * Session-free account operations (export + destructive deletion), kept separate from
 * ./account so they can be exercised directly by integration tests against a scratch
 * libSQL/Turso target. This module imports neither `server-only` nor the auth session
 * (which would fail outside the Next runtime); the session-scoped wrappers live in
 * ./account and pass in `db` + the authenticated user id. Mirrors ./checkin-writes.
 *
 * Every query is scoped to the given userId. The one junction table without a user_id
 * column (check_in_tag) is only ever reached through the user's own check-ins.
 */

export type Database = LibSQLDatabase<typeof schema>;
type Statement = BatchItem<"sqlite">;

// ---------------------------------------------------------------------------
// Data export (PRD 20)
// ---------------------------------------------------------------------------

export type UserDataExport = {
  exportedAt: string;
  app: string;
  formatVersion: number;
  account: {
    id: string;
    email: string | null;
    name: string | null;
  };
  profile: {
    displayName: string | null;
    timezone: string;
    weekStartsOn: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  behaviors: (typeof behaviors.$inferSelect)[];
  behaviorCategories: (typeof behaviorCategories.$inferSelect)[];
  dailyBehaviorEntries: (typeof dailyBehaviorEntries.$inferSelect)[];
  outcomeMetrics: (typeof outcomeMetrics.$inferSelect)[];
  checkIns: (typeof checkIns.$inferSelect)[];
  checkInValues: (typeof checkInValues.$inferSelect)[];
  tags: (typeof tags.$inferSelect)[];
  checkInTags: { checkInId: string; tagId: string; tagName: string }[];
  reminderSettings: typeof reminderSettings.$inferSelect | null;
  pushSubscriptions: (typeof pushSubscriptions.$inferSelect)[];
};

/**
 * Gathers everything the given user owns into one export object (PRD 20). Read-only and
 * strictly scoped to userId. `nowIso` is passed in so the caller controls the timestamp
 * (and tests stay deterministic).
 */
export async function exportUserDataForUser(
  database: Database,
  userId: string,
  nowIso: string,
): Promise<UserDataExport> {
  const [
    user,
    profile,
    categories,
    userBehaviors,
    entries,
    metrics,
    userCheckIns,
    values,
    userTags,
    tagLinks,
    reminder,
    subscriptions,
  ] = await Promise.all([
    database
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    database.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
    database
      .select()
      .from(behaviorCategories)
      .where(eq(behaviorCategories.userId, userId))
      .orderBy(asc(behaviorCategories.sortOrder), asc(behaviorCategories.createdAt)),
    database
      .select()
      .from(behaviors)
      .where(eq(behaviors.userId, userId))
      .orderBy(asc(behaviors.sortOrder), asc(behaviors.createdAt)),
    database
      .select()
      .from(dailyBehaviorEntries)
      .where(eq(dailyBehaviorEntries.userId, userId))
      .orderBy(asc(dailyBehaviorEntries.entryDate)),
    database
      .select()
      .from(outcomeMetrics)
      .where(eq(outcomeMetrics.userId, userId))
      .orderBy(asc(outcomeMetrics.sortOrder), asc(outcomeMetrics.createdAt)),
    database
      .select()
      .from(checkIns)
      .where(eq(checkIns.userId, userId))
      .orderBy(asc(checkIns.occurredAt)),
    database.select().from(checkInValues).where(eq(checkInValues.userId, userId)),
    database
      .select()
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(asc(tags.name)),
    database
      .select({
        checkInId: checkInTags.checkInId,
        tagId: checkInTags.tagId,
        tagName: tags.name,
      })
      .from(checkInTags)
      .innerJoin(checkIns, eq(checkInTags.checkInId, checkIns.id))
      .innerJoin(tags, eq(checkInTags.tagId, tags.id))
      .where(eq(checkIns.userId, userId)),
    database
      .select()
      .from(reminderSettings)
      .where(eq(reminderSettings.userId, userId))
      .limit(1),
    database
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .orderBy(asc(pushSubscriptions.createdAt)),
  ]);

  return {
    exportedAt: nowIso,
    app: "feelium",
    formatVersion: 2,
    account: user[0] ?? { id: userId, email: null, name: null },
    profile: profile[0]
      ? {
          displayName: profile[0].displayName,
          timezone: profile[0].timezone,
          weekStartsOn: profile[0].weekStartsOn,
          createdAt: profile[0].createdAt,
          updatedAt: profile[0].updatedAt,
        }
      : null,
    behaviors: userBehaviors,
    behaviorCategories: categories,
    dailyBehaviorEntries: entries,
    outcomeMetrics: metrics,
    checkIns: userCheckIns,
    checkInValues: values,
    tags: userTags,
    checkInTags: tagLinks,
    reminderSettings: reminder[0] ?? null,
    pushSubscriptions: subscriptions,
  };
}

// ---------------------------------------------------------------------------
// Destructive deletion (PRD 19 / 21)
// ---------------------------------------------------------------------------

// The user-owned tracking tables, as one atomic batch. Order is child-before-parent so it
// is safe regardless of cascade behaviour; check_in_tag is reached via the user's own
// check-ins only.
function trackingDeletes(
  database: Database,
  userId: string,
): [Statement, ...Statement[]] {
  return [
    database.delete(checkInTags).where(
      inArray(
        checkInTags.checkInId,
        database
          .select({ id: checkIns.id })
          .from(checkIns)
          .where(eq(checkIns.userId, userId)),
      ),
    ),
    database.delete(checkInValues).where(eq(checkInValues.userId, userId)),
    database.delete(checkIns).where(eq(checkIns.userId, userId)),
    database.delete(dailyBehaviorEntries).where(eq(dailyBehaviorEntries.userId, userId)),
    database.delete(behaviors).where(eq(behaviors.userId, userId)),
    database.delete(behaviorCategories).where(eq(behaviorCategories.userId, userId)),
    database.delete(outcomeMetrics).where(eq(outcomeMetrics.userId, userId)),
    database.delete(tags).where(eq(tags.userId, userId)),
    database.delete(reminderSettings).where(eq(reminderSettings.userId, userId)),
    database.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)),
  ];
}

/** Deletes all of the user's tracking data but keeps their account/profile/auth (PRD 19). */
export async function deleteAllTrackingDataForUser(
  database: Database,
  userId: string,
): Promise<void> {
  await database.batch(trackingDeletes(database, userId));
}

/**
 * Permanently deletes the user's account and everything scoped to it (PRD 19/21): all
 * tracking data plus the profile, OAuth account links, any session rows, and finally the
 * user record itself.
 */
export async function deleteAccountForUser(
  database: Database,
  userId: string,
): Promise<void> {
  await database.batch([
    ...trackingDeletes(database, userId),
    database.delete(profiles).where(eq(profiles.userId, userId)),
    database.delete(accounts).where(eq(accounts.userId, userId)),
    database.delete(sessions).where(eq(sessions.userId, userId)),
    database.delete(users).where(eq(users.id, userId)),
  ]);
}
