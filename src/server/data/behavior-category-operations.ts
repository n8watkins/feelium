import { and, asc, eq } from "drizzle-orm";

import {
  BEHAVIOR_CATEGORY_COLORS,
  isBehaviorCategoryColor,
  normalizeBehaviorCategoryName,
  type BehaviorCategoryColor,
} from "@/config/behavior-categories";
import { behaviorCategories } from "@/db/schema";

type AppDatabase = (typeof import("@/db"))["db"];

function validateName(name: string): { name: string; normalizedName: string } {
  const displayName = name.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeBehaviorCategoryName(displayName);
  if (!displayName || !normalizedName) throw new Error("INVALID_CATEGORY_NAME");
  return { name: displayName, normalizedName };
}

function leastUsedColor(rows: { color: BehaviorCategoryColor }[]): BehaviorCategoryColor {
  const counts = new Map<BehaviorCategoryColor, number>(
    BEHAVIOR_CATEGORY_COLORS.map((color) => [color, 0]),
  );
  for (const row of rows) counts.set(row.color, (counts.get(row.color) ?? 0) + 1);
  return BEHAVIOR_CATEGORY_COLORS.reduce((best, color) =>
    (counts.get(color) ?? 0) < (counts.get(best) ?? 0) ? color : best,
  );
}

export async function listBehaviorCategoriesForUser(
  database: AppDatabase,
  userId: string,
) {
  return database
    .select()
    .from(behaviorCategories)
    .where(eq(behaviorCategories.userId, userId))
    .orderBy(asc(behaviorCategories.sortOrder), asc(behaviorCategories.createdAt));
}

export async function createBehaviorCategoryForUser(
  database: AppDatabase,
  userId: string,
  name: string,
) {
  const values = validateName(name);
  const existing = await listBehaviorCategoriesForUser(database, userId);
  const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
  const [row] = await database
    .insert(behaviorCategories)
    .values({
      userId,
      ...values,
      color: leastUsedColor(existing),
      sortOrder,
    })
    .returning();
  return row;
}

export async function updateBehaviorCategoryForUser(
  database: AppDatabase,
  userId: string,
  id: string,
  input: { name: string; color: BehaviorCategoryColor },
): Promise<boolean> {
  const values = validateName(input.name);
  if (!isBehaviorCategoryColor(input.color)) throw new Error("INVALID_CATEGORY_COLOR");
  const rows = await database
    .update(behaviorCategories)
    .set({ ...values, color: input.color, updatedAt: new Date() })
    .where(and(eq(behaviorCategories.id, id), eq(behaviorCategories.userId, userId)))
    .returning({ id: behaviorCategories.id });
  return rows.length === 1;
}

export async function moveBehaviorCategoryForUser(
  database: AppDatabase,
  userId: string,
  id: string,
  direction: "up" | "down",
): Promise<boolean> {
  const categories = await listBehaviorCategoriesForUser(database, userId);
  const index = categories.findIndex((category) => category.id === id);
  if (index === -1) return false;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= categories.length) return false;
  const current = categories[index];
  const adjacent = categories[swapIndex];
  await database.batch([
    database
      .update(behaviorCategories)
      .set({ sortOrder: adjacent.sortOrder, updatedAt: new Date() })
      .where(
        and(
          eq(behaviorCategories.id, current.id),
          eq(behaviorCategories.userId, userId),
        ),
      ),
    database
      .update(behaviorCategories)
      .set({ sortOrder: current.sortOrder, updatedAt: new Date() })
      .where(
        and(
          eq(behaviorCategories.id, adjacent.id),
          eq(behaviorCategories.userId, userId),
        ),
      ),
  ]);
  return true;
}

export async function deleteBehaviorCategoryForUser(
  database: AppDatabase,
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await database
    .delete(behaviorCategories)
    .where(and(eq(behaviorCategories.id, id), eq(behaviorCategories.userId, userId)))
    .returning({ id: behaviorCategories.id });
  return rows.length === 1;
}

export async function resolveOwnedBehaviorCategoryId(
  database: AppDatabase,
  userId: string,
  categoryId: string | null,
): Promise<string | null> {
  if (!categoryId) return null;
  const [row] = await database
    .select({ id: behaviorCategories.id })
    .from(behaviorCategories)
    .where(
      and(
        eq(behaviorCategories.id, categoryId),
        eq(behaviorCategories.userId, userId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("CATEGORY_NOT_FOUND");
  return row.id;
}
