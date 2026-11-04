"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteCheckInAction } from "@/app/(app)/history/actions";
import { Button } from "@/components/ui/button";
import { toastDeleted } from "@/components/undo-toast";

/**
 * Deletes a check-in at once (PRD 15.3), then offers Undo in the toast, which puts it back
 * with its values and tags. On failure nothing changes and a toast says why.
 */
export function DeleteCheckInButton({
  checkInId,
  date,
  time,
}: {
  checkInId: string;
  date: string;
  /** "9:30 AM", to name it in the button and the toast. */
  time: string;
}) {
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteCheckInAction(checkInId, date);
      if (result.ok) toastDeleted(`Check-in at ${time} deleted`, result.undoId);
      else toast.error(result.error);
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={remove}
      disabled={isPending}
      aria-label={`Delete the ${time} check-in`}
      className="h-10 flex-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2 className="size-4" aria-hidden="true" />
      {isPending ? "Deleting…" : "Delete"}
    </Button>
  );
}
