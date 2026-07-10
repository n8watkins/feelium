import "server-only";

import { count, eq } from "drizzle-orm";

import type { StarterBehavior, StarterOutcome } from "@/config/tracking";
import { db } from "@/db";
import { behaviors, outcomeMetrics } from "@/db/schema";
import { requireUserId } from "./session";

/** Total behaviors and outcomes for the user (active + archived), for the onboarding gate. */
export async function getTrackingCounts(): Promise<{
  behaviors: number;
  outcomes: number;
}> {
  const userId = await requireUserId();
  const [b] = await db
    .select({ n: count() })
    .from(behaviors)
    .where(eq(behaviors.userId, userId));
  const [o] = await db
    .select({ n: count() })
    .from(outcomeMetrics)
    .where(eq(outcomeMetrics.userId, userId));
  return { behaviors: b?.n ?? 0, outcomes: o?.n ?? 0 };
}

/** Bulk-creates the chosen starter behaviors and outcomes in one transaction (PRD 11.2). */
export async function createStarterItems(
  starterBehaviors: StarterBehavior[],
  starterOutcomes: StarterOutcome[],
): Promise<void> {
  const userId = await requireUserId();
  await db.transaction(async (tx) => {
    if (starterBehaviors.length > 0) {
      await tx.insert(behaviors).values(
        starterBehaviors.map((b, index) => ({
          userId,
          name: b.name,
          inputType: b.inputType,
          desiredDirection: b.desiredDirection,
          unit: b.unit ?? null,
          sortOrder: index,
        })),
      );
    }
    if (starterOutcomes.length > 0) {
      await tx.insert(outcomeMetrics).values(
        starterOutcomes.map((o, index) => ({
          userId,
          name: o.name,
          inputType: o.inputType,
          desiredDirection: o.desiredDirection,
          sortOrder: index,
        })),
      );
    }
  });
}
