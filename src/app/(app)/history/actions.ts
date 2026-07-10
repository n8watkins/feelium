"use server";

import { revalidatePath } from "next/cache";

import { deleteCheckIn } from "@/server/data";

export type DeleteCheckInResult = { ok: boolean; error?: string };

/**
 * Deletes a check-in from a History day. Values and tag links cascade in the data layer;
 * we revalidate every view that showed it so it does not reappear.
 */
export async function deleteCheckInAction(
  id: string,
  date: string,
): Promise<DeleteCheckInResult> {
  let removed: boolean;
  try {
    removed = await deleteCheckIn(id);
  } catch {
    return { ok: false, error: "Something went wrong deleting the check-in." };
  }
  if (!removed) return { ok: false, error: "That check-in could not be found." };

  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath(`/history/${date}`);
  return { ok: true };
}
