"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { UNDO_TOAST_MS } from "@/components/undo-toast";

/**
 * Archives a behavior at once: it leaves Today and keeps all of its history. The toast
 * offers Undo, which puts it back in the same place.
 */
export function ArchiveButton({
  id,
  name,
  action,
  undoAction,
}: {
  id: string;
  name: string;
  action: (formData: FormData) => Promise<void>;
  undoAction: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function form() {
    const formData = new FormData();
    formData.set("id", id);
    return formData;
  }

  function archive() {
    startTransition(async () => {
      try {
        await action(form());
        toast(`${name} archived`, {
          description: "It's off Today. Its history stays, and you can reactivate it anytime.",
          duration: UNDO_TOAST_MS,
          action: { label: "Undo", onClick: () => void undoAction(form()) },
        });
      } catch {
        toast.error(`Couldn't archive ${name}.`);
      }
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={archive} disabled={isPending}>
      {isPending ? "Archiving…" : "Archive"}
    </Button>
  );
}
