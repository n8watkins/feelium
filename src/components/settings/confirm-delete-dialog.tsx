"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DeleteResult = { ok: boolean; error?: string };

/**
 * A strong, type-to-confirm destructive-action dialog (PRD 19). The confirm button stays
 * disabled until the user types the exact `confirmPhrase`, so deletions are always
 * deliberate. On success the server action redirects (navigating away closes the dialog);
 * on failure the dialog stays open and shows the error inline and as a toast, so nothing
 * is lost silently.
 *
 * We use a plain Button for confirm (not AlertDialogAction) so a failed action does not
 * auto-close the dialog.
 */
export function ConfirmDeleteDialog({
  trigger,
  title,
  description,
  confirmPhrase,
  confirmHint,
  confirmLabel,
  pendingLabel,
  action,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmPhrase: string;
  confirmHint: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  action: (confirmation: string) => Promise<DeleteResult>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputId = useId();
  const errorId = useId();
  const matches = value.trim() === confirmPhrase;

  function reset() {
    setValue("");
    setError(null);
  }

  function confirm() {
    if (!matches || isPending) return;
    setError(null);
    startTransition(async () => {
      // On success the action redirects and this component unmounts; only a returned
      // failure reaches here.
      const result = await action(value.trim());
      if (!result.ok) {
        const message = result.error ?? "Something went wrong. Please try again.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return; // don't dismiss mid-delete
        setOpen(next);
        if (!next) reset();
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 text-left">
          <Label htmlFor={inputId}>{confirmHint}</Label>
          <Input
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={isPending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
            }}
          />
          {error ? (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={!matches || isPending}
          >
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
