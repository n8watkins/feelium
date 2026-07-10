import "server-only";

import type { BatchItem } from "drizzle-orm/batch";
import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  accounts,
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
import { requireUserId } from "./session";

type Statement = BatchItem<"sqlite">;

// ---------------------------------------------------------------------------
// Data export (PRD 20)
// ---------------------------------------------------------------------------

/**
 * The full personal-data export shape. Every table the user owns is included, plus their
 * account identity and profile. `Date` fields serialize to ISO 8601 strings via JSON.
 * check_in notes live on each check-in row; tag links carry both ids and the tag name so
 * the export reads standalone.
 */
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
 * Gathers everything the signed-in user owns into one export object (PRD 20). Read-only and
 * strictly session-scoped: every query filters by the authenticated user id, and the
 * junction table (check_in_tags, which has no user_id) is reached only through the user's
 * own check-ins.
 */
export async function exportUserData(): Promise<UserDataExport> {
  const userId = await requireUserId();

  const [
    user,
    profile,
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
    db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db
      .select()
      .from(behaviors)
      .where(eq(behaviors.userId, userId))
      .orderBy(asc(behaviors.sortOrder), asc(behaviors.createdAt)),
    db
      .select()
      .from(dailyBehaviorEntries)
      .where(eq(dailyBehaviorEntries.userId, userId))
      .orderBy(asc(dailyBehaviorEntries.entryDate)),
    db
      .select()
      .from(outcomeMetrics)
      .where(eq(outcomeMetrics.userId, userId))
      .orderBy(asc(outcomeMetrics.sortOrder), asc(outcomeMetrics.createdAt)),
    db
      .select()
      .from(checkIns)
      .where(eq(checkIns.userId, userId))
      .orderBy(asc(checkIns.occurredAt)),
    db
      .select()
      .from(checkInValues)
      .where(eq(checkInValues.userId, userId)),
    db
      .select()
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(asc(tags.name)),
    db
      .select({
        checkInId: checkInTags.checkInId,
        tagId: checkInTags.tagId,
        tagName: tags.name,
      })
      .from(checkInTags)
      .innerJoin(checkIns, eq(checkInTags.checkInId, checkIns.id))
      .innerJoin(tags, eq(checkInTags.tagId, tags.id))
      .where(eq(checkIns.userId, userId)),
    db
      .select()
      .from(reminderSettings)
      .where(eq(reminderSettings.userId, userId))
      .limit(1),
    db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .orderBy(asc(pushSubscriptions.createdAt)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    app: "feelium",
    formatVersion: 1,
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
// Destructive deletion (PRD 19 / 21) - always strictly session-scoped
// ---------------------------------------------------------------------------

// The user-owned tracking tables, deleted as one atomic batch. Order is child-before-parent
// so the delete is safe regardless of cascade behaviour. The junction tables (check_in_tag,
// check_in_value) are removed via their parents' cascades and also explicitly here; both
// are scoped to the user's own rows only.
function trackingDeletes(userId: string): [Statement, ...Statement[]] {
  return [
    // Check-in children first (also covered by cascade, but explicit and auditable).
    db.delete(checkInTags).where(
      inArray(
        checkInTags.checkInId,
        db.select({ id: checkIns.id }).from(checkIns).where(eq(checkIns.userId, userId)),
      ),
    ),
    db.delete(checkInValues).where(eq(checkInValues.userId, userId)),
    db.delete(checkIns).where(eq(checkIns.userId, userId)),
    // Behavior entries then behaviors.
    db.delete(dailyBehaviorEntries).where(eq(dailyBehaviorEntries.userId, userId)),
    db.delete(behaviors).where(eq(behaviors.userId, userId)),
    // Outcomes and tags (their remaining links are already gone above).
    db.delete(outcomeMetrics).where(eq(outcomeMetrics.userId, userId)),
    db.delete(tags).where(eq(tags.userId, userId)),
    // Notification data.
    db.delete(reminderSettings).where(eq(reminderSettings.userId, userId)),
    db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)),
  ];
}

/**
 * Deletes ALL of the signed-in user's tracking data - behaviors, entries, outcomes,
 * check-ins, values, tags, links, reminder settings, and push subscriptions - while keeping
 * the account, profile, and auth records (PRD 19 "Delete all tracking data"). The user
 * lands on a clean empty state and can keep using the app. Atomic via db.batch().
 */
export async function deleteAllTrackingData(): Promise<void> {
  const userId = await requireUserId();
  await db.batch(trackingDeletes(userId));
}

/**
 * Permanently deletes the signed-in user's account and everything scoped to it: all
 * tracking data (above) plus the profile, OAuth account links, any session rows, and
 * finally the user record itself (PRD 19 "Delete account", PRD 21). Atomic via db.batch().
 * After this returns the caller must sign the user out; a leftover JWT is handled by the
 * stale-session guard (see StaleSessionError) on the next request.
 */
export async function deleteAccount(): Promise<void> {
  const userId = await requireUserId();
  await db.batch([
    ...trackingDeletes(userId),
    db.delete(profiles).where(eq(profiles.userId, userId)),
    db.delete(accounts).where(eq(accounts.userId, userId)),
    db.delete(sessions).where(eq(sessions.userId, userId)),
    // The user row last: with it gone, any surviving JWT is a stale session.
    db.delete(users).where(eq(users.id, userId)),
  ]);
}
