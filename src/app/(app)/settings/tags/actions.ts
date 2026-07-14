"use server";

import { revalidatePath } from "next/cache";

import { createTag, deleteTag, renameTag } from "@/server/data";
import { MAX_NAME_LENGTH, recordIdSchema } from "@/lib/validation";

const LIST_PATH = "/settings/tags";

export type TagFormState = { error?: string; ok?: boolean };

export async function createTagAction(
  _prev: TagFormState,
  formData: FormData,
): Promise<TagFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter a tag name." };
  if (name.length > MAX_NAME_LENGTH)
    return { error: `Keep tag names under ${MAX_NAME_LENGTH} characters.` };

  const created = await createTag(name);
  if (!created) return { error: "You already have a tag with that name." };

  revalidatePath(LIST_PATH);
  return { ok: true };
}

export async function renameTagAction(formData: FormData) {
  const id = recordIdSchema.safeParse(String(formData.get("id") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  if (id.success && name && name.length <= MAX_NAME_LENGTH) {
    await renameTag(id.data, name);
    revalidatePath(LIST_PATH);
  }
}

export async function deleteTagAction(formData: FormData) {
  await deleteTag(recordIdSchema.parse(String(formData.get("id") ?? "")));
  revalidatePath(LIST_PATH);
}
