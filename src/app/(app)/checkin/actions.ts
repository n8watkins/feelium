"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { safeRedirectPath } from "@/lib/safe-redirect";
import { checkInPayloadSchema, recordIdSchema } from "@/lib/validation";
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

// A check-in shows on Today, on the History list, and on its date's day detail.
function revalidateCheckInViews(localDate: string) {
  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath(`/history/${localDate}`);
}

export async function createCheckInAction(
  payload: CheckInPayload,
): Promise<CheckInResult | void> {
  const parsed = checkInPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Some check-in values were invalid." };
  }
  if (!hasContent(parsed.data)) {
    return { ok: false, error: "Add at least one outcome, tag, or note." };
  }

  try {
    await createCheckIn(parsed.data);
  } catch {
    return { ok: false, error: "Something went wrong saving your check-in." };
  }

  revalidateCheckInViews(parsed.data.localDate);
  // Land back on Today with a success confirmation (the ?checkin=saved flag drives a toast).
  redirect("/today?checkin=saved");
}

export async function updateCheckInAction(
  id: string,
  payload: CheckInPayload,
  returnTo?: string,
): Promise<CheckInResult | void> {
  const checkInId = recordIdSchema.safeParse(id);
  const parsed = checkInPayloadSchema.safeParse(payload);
  if (!checkInId.success || !parsed.success) {
    return { ok: false, error: "Some check-in values were invalid." };
  }
  if (!hasContent(parsed.data)) {
    return { ok: false, error: "Add at least one outcome, tag, or note." };
  }

  try {
    const ok = await updateCheckIn(checkInId.data, parsed.data);
    if (!ok) return { ok: false, error: "That check-in could not be found." };
  } catch {
    return { ok: false, error: "Something went wrong saving your check-in." };
  }

  revalidateCheckInViews(parsed.data.localDate);
  // Edits launched from History return to that day; everything else to Today.
  redirect(safeRedirectPath(returnTo, "/today"));
}
