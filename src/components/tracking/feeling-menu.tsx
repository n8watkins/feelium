"use client";

import { Archive, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import type { DeleteOutcomeResult } from "@/app/(app)/settings/outcomes/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";

type Action = (formData: FormData) => Promise<void>;

function answersLabel(n: number) {
  return n === 1 ? "1 answer" : `${n} answers`;
}

/**
 * The "More" menu on a feeling in Settings: edit it, archive it, or delete it.
 * Archiving is instant and undoable from the toast. Deleting asks first; past answers
 * stay in History unless the user also ticks "erase", which can't be undone.
 */
export function FeelingMenu({
  id,
  name,
  answers,
  isActive,
  archiveAction,
  reactivateAction,
  deleteAction,
}: {
  id: string;
  name: string;
  answers: number;
  isActive: boolean;
  archiveAction: Action;
  reactivateAction: Action;
  deleteAction: (formData: FormData) => Promise<DeleteOutcomeResult>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [erase, setErase] = useState(false);
  const [isPending, startTransition] = useTransition();
  const eraseId = useId();

  function run(action: Action, extra?: Record<string, string>) {
    const formData = new FormData();
    formData.set("id", id);
    for (const [key, value] of Object.entries(extra ?? {})) formData.set(key, value);
    return action(formData);
  }

  function archive() {
    startTransition(async () => {
      try {
        await run(archiveAction);
        toast.success(`${name} archived`, {
          description: "It's off your check-in. Its answers stay in History and Insights.",
          action: { label: "Undo", onClick: () => void run(reactivateAction) },
        });
      } catch {
        toast.error(`Couldn't archive ${name}. Try again.`);
      }
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      if (erase) formData.set("eraseAnswers", "on");
      try {
        const result = await deleteAction(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setConfirmOpen(false);
        toast.success(`${name} deleted`, {
          description:
            answers > 0 && !result.erased
              ? "Your past answers stay on their days in History."
              : undefined,
        });
      } catch {
        toast.error(`Couldn't delete ${name}. Try again.`);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`More for ${name}`}
            disabled={isPending}
            className="size-11 rounded-full text-muted-foreground hover:text-foreground md:size-9"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
          <DropdownMenuItem asChild className="min-h-10 rounded-xl px-3">
            <Link href={`/settings/outcomes/${id}`}>
              <Pencil aria-hidden="true" />
              Rename or edit
            </Link>
          </DropdownMenuItem>
          {isActive ? (
            <DropdownMenuItem className="min-h-10 rounded-xl px-3" onSelect={archive}>
              <Archive aria-hidden="true" />
              Archive
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="min-h-10 rounded-xl px-3"
            onSelect={() => {
              setErase(false);
              setConfirmOpen(true);
            }}
          >
            <Trash2 aria-hidden="true" />
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!isPending) setConfirmOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {answers > 0
                ? `It leaves your check-in, Settings and Insights. The ${answersLabel(answers)} you already gave stay on their days in History.`
                : "It leaves your check-in. You haven't answered it yet, so nothing else changes."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {answers > 0 ? (
            <div className="flex items-start gap-3 rounded-2xl border border-border p-4 text-left">
              <Checkbox
                id={eraseId}
                checked={erase}
                onCheckedChange={(value) => setErase(value === true)}
                disabled={isPending}
                className="mt-0.5"
              />
              <Label htmlFor={eraseId} className="block space-y-1 font-normal">
                <span className="block text-sm font-medium">
                  Also erase {answers === 1 ? "that answer" : `those ${answers} answers`}
                </span>
                <span className="block text-sm text-muted-foreground">
                  Removes them from every past check-in. This can&apos;t be undone.
                </span>
              </Label>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Deleting…" : erase ? "Delete and erase" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
