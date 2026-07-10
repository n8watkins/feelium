"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createCheckIn,
  updateCheckIn,
  type CheckInPayload,
} from "@/server/data";

export type CheckInResult = { ok: false; error: string };

function hasContent(payload: CheckInPayload): boolean {
  const answered = payload.values.some(
    (v) => v.rating != null || v.boolean != null || v.numeric != null,
  );
  const hasNote = Boolean(payload.note && payload.note.trim());
  const hasTags = payload.tagIds.length > 0 || payload.newTagNames.length > 0;
  return answered || hasNote || hasTags;
}

export async function createCheckInAction(
  payload: CheckInPayload,
): Promise<CheckInResult | void> {
  if (!hasContent(payload)) {
    return { ok: false, error: "Add at least one outcome, tag, or note." };
  }

  try {
    await createCheckIn(payload);
  } catch {
    return { ok: false, error: "Something went wrong saving your check-in." };
  }

  revalidatePath("/today");
  revalidatePath("/history");
  redirect("/today");
}

export async function updateCheckInAction(
  id: string,
  payload: CheckInPayload,
): Promise<CheckInResult | void> {
  if (!hasContent(payload)) {
    return { ok: false, error: "Add at least one outcome, tag, or note." };
  }

  try {
    const ok = await updateCheckIn(id, payload);
    if (!ok) return { ok: false, error: "That check-in could not be found." };
  } catch {
    return { ok: false, error: "Something went wrong saving your check-in." };
  }

  revalidatePath("/today");
  revalidatePath("/history");
  redirect("/today");
}
