"use server";

import { revalidatePath } from "next/cache";

import {
  isBehaviorCategoryColor,
  type BehaviorCategoryColor,
} from "@/config/behavior-categories";
import { MAX_NAME_LENGTH } from "@/lib/validation";
import {
  createBehaviorCategory,
  deleteBehaviorCategory,
  moveBehaviorCategory,
  updateBehaviorCategory,
} from "@/server/data";

export type CategoryFormState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function revalidateCategoryPaths() {
  revalidatePath("/settings/behaviors/categories");
  revalidatePath("/settings/behaviors");
  revalidatePath("/settings/behaviors/new");
  revalidatePath("/settings/behaviors/[id]", "page");
  revalidatePath("/today");
  revalidatePath("/checkin/new");
}

function validName(formData: FormData): string | null {
  const name = String(formData.get("name") ?? "").trim();
  return name && name.length <= MAX_NAME_LENGTH ? name : null;
}

function categoryError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const cause = error instanceof Error && error.cause instanceof Error
    ? error.cause.message
    : "";
  if (`${message} ${cause}`.toLowerCase().includes("unique")) {
    return "A category with that name already exists.";
  }
  return "Could not save the category. Please try again.";
}

export async function createCategoryAction(
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const name = validName(formData);
  if (!name) return { error: `Enter a name up to ${MAX_NAME_LENGTH} characters.` };
  try {
    await createBehaviorCategory(name);
  } catch (error) {
    return { error: categoryError(error) };
  }
  revalidateCategoryPaths();
  return { ok: true, message: `${name} added.` };
}

export async function updateCategoryAction(
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const id = String(formData.get("id") ?? "");
  const name = validName(formData);
  const color = String(formData.get("color") ?? "");
  if (!id || !name || !isBehaviorCategoryColor(color)) {
    return { error: "Enter a valid name and color." };
  }
  try {
    const updated = await updateBehaviorCategory(id, {
      name,
      color: color as BehaviorCategoryColor,
    });
    if (!updated) return { error: "That category no longer exists." };
  } catch (error) {
    return { error: categoryError(error) };
  }
  revalidateCategoryPaths();
  return { ok: true, message: `${name} saved.` };
}

export async function moveCategoryAction(
  id: string,
  direction: "up" | "down",
): Promise<CategoryFormState> {
  const moved = await moveBehaviorCategory(id, direction);
  if (!moved) return { error: "That category could not be moved." };
  revalidateCategoryPaths();
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<CategoryFormState> {
  const deleted = await deleteBehaviorCategory(id);
  if (!deleted) return { error: "That category no longer exists." };
  revalidateCategoryPaths();
  return { ok: true };
}
