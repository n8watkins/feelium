"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Archives a behavior or outcome behind a light confirmation (mirrors the delete-check-in
 * confirm), then a toast reminds the user it can be reactivated. Archiving is reversible and
 * preserves history, so this is a gentle confirm rather than a destructive warning.
 */
export function ArchiveButton({
  id,
  name,
  action,
}: {
  id: string;
  name: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function confirmArchive() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      try {
        await action(formData);
        toast.success(`${name} archived.`, {
          description: "Its history is kept - reactivate it anytime in Settings.",
        });
      } catch {
        toast.error(`Couldn't archive ${name}.`);
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          Archive
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            It moves out of active tracking but keeps all of its history. You can
            reactivate it anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep</AlertDialogCancel>
          <AlertDialogAction onClick={confirmArchive} disabled={isPending}>
            {isPending ? "Archiving…" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
