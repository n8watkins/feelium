import "server-only";

import type { BehaviorCategoryColor } from "@/config/behavior-categories";
import { db } from "@/db";
import {
  createBehaviorCategoryForUser,
  deleteBehaviorCategoryForUser,
  listBehaviorCategoriesForUser,
  moveBehaviorCategoryForUser,
  updateBehaviorCategoryForUser,
} from "./behavior-category-operations";
import { requireUserId } from "./session";

export async function listBehaviorCategories() {
  return listBehaviorCategoriesForUser(db, await requireUserId());
}

export async function createBehaviorCategory(name: string) {
  return createBehaviorCategoryForUser(db, await requireUserId(), name);
}

export async function updateBehaviorCategory(
  id: string,
  input: { name: string; color: BehaviorCategoryColor },
) {
  return updateBehaviorCategoryForUser(db, await requireUserId(), id, input);
}

export async function moveBehaviorCategory(id: string, direction: "up" | "down") {
  return moveBehaviorCategoryForUser(db, await requireUserId(), id, direction);
}

export async function deleteBehaviorCategory(id: string) {
  return deleteBehaviorCategoryForUser(db, await requireUserId(), id);
}
