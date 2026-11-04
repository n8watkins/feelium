"use server";

import { revalidatePath } from "next/cache";

import { recordIdSchema } from "@/lib/validation";
import { undoDelete } from "@/server/data";

export type UndoResult = { ok: true } | { ok: false; error: string };

/** The Undo in a "deleted" toast: puts the deleted thing back exactly as it was. */
export async function undoDeleteAction(undoId: string): Promise<UndoResult> {
  const id = recordIdSchema.safeParse(undoId);
  if (!id.success) return { ok: false, error: "That can't be undone any more." };
  const kind = await undoDelete(id.data);
  if (!kind) return { ok: false, error: "That can't be undone any more." };
  // Whatever it was can show up on any screen of the app.
  revalidatePath("/", "layout");
  return { ok: true };
}
