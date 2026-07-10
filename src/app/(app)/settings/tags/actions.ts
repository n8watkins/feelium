"use server";

import { revalidatePath } from "next/cache";

import { createTag, deleteTag, renameTag } from "@/server/data";

const LIST_PATH = "/settings/tags";

export type TagFormState = { error?: string; ok?: boolean };

export async function createTagAction(
  _prev: TagFormState,
  formData: FormData,
): Promise<TagFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter a tag name." };

  const created = await createTag(name);
  if (!created) return { error: "You already have a tag with that name." };

  revalidatePath(LIST_PATH);
  return { ok: true };
}

export async function renameTagAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (id && name) {
    await renameTag(id, name);
    revalidatePath(LIST_PATH);
  }
}

export async function deleteTagAction(formData: FormData) {
  await deleteTag(String(formData.get("id") ?? ""));
  revalidatePath(LIST_PATH);
}
