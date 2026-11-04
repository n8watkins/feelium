import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { tags } from "@/db/schema";
import { requireUserId } from "./session";

export async function listTags() {
  const userId = await requireUserId();
  return db
    .select()
    .from(tags)
    .where(eq(tags.userId, userId))
    .orderBy(asc(tags.name));
}

/** Creates a tag. Returns null if the user already has a tag with that name. */
export async function createTag(name: string) {
  const userId = await requireUserId();
  const [row] = await db
    .insert(tags)
    .values({ userId, name })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function renameTag(id: string, name: string) {
  const userId = await requireUserId();
  await db
    .update(tags)
    .set({ name })
    .where(and(eq(tags.id, id), eq(tags.userId, userId)));
}

