"use server";

import { revalidatePath } from "next/cache";

import { deleteCheckIn } from "@/server/data";

export type DeleteCheckInResult = { ok: true; undoId: string } | { ok: false; error: string };

/**
 * Deletes a check-in at once, with its values and tag links, and returns the id its Undo
 * uses (see undoDeleteAction). Every view that showed it is revalidated.
 */
export async function deleteCheckInAction(
  id: string,
  date: string,
): Promise<DeleteCheckInResult> {
  let removed: Awaited<ReturnType<typeof deleteCheckIn>>;
  try {
    removed = await deleteCheckIn(id);
  } catch {
    return { ok: false, error: "Something went wrong deleting the check-in." };
  }
  if (!removed) return { ok: false, error: "That check-in could not be found." };

  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath(`/history/${date}`);
  return { ok: true, undoId: removed.undoId };
}
