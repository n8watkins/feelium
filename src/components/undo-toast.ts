"use client";

import { toast } from "sonner";

import { undoDeleteAction } from "@/app/(app)/undo-actions";

/** How long the "deleted" toast, and so its Undo, stays up. */
export const UNDO_TOAST_MS = 6000;

/**
 * The toast after a delete: "<what> deleted" with an Undo that puts it back exactly.
 * The delete already happened on the server; Undo restores it from there.
 */
export function toastDeleted(message: string, undoId: string, description?: string) {
  toast(message, {
    description,
    duration: UNDO_TOAST_MS,
    action: {
      label: "Undo",
      onClick: async () => {
        const result = await undoDeleteAction(undoId);
        if (result.ok) toast.success("Restored");
        else toast.error(result.error);
      },
    },
  });
}
